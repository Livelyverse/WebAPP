import { Injectable, Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import { InjectEntityManager } from "@nestjs/typeorm";
import { TweetV2, TwitterApi } from "twitter-api-v2";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { finalize } from "rxjs";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { SocialEventEntity } from "../../entity/socialEvent.entity";
import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { TwitterApiError } from "../../error/TwitterApiError";
import { TweetEventDto } from "../../dto/tweetEvent.dto";
import moment from "moment";
import { ContentDto } from "../../dto/content.dto";
import { UserV2 } from "twitter-api-v2/dist/types/v2/user.v2.types";
import { SocialProfileEntity } from "../../../../profile/domain/entity/socialProfile.entity";
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialActionType } from "../../entity/enums";

@Injectable()
export class TweetTrackerJob {
  private readonly _logger = new Logger(TweetTrackerJob.name);
  private readonly _authToken: string;
  private readonly _twitterClient: TwitterApiv2ReadOnly;
  private readonly _trackerDuration: number;
  private readonly _trackerInterval: number;

  constructor(
      @InjectEntityManager()
      private readonly _entityManager: EntityManager,
      private readonly _configService: ConfigService,
      private readonly _schedulerRegistry: SchedulerRegistry
  ) {
    this._authToken = this._configService.get<string>('airdrop.twitter.authToken');
    if (!this._authToken) {
      throw new Error("airdrop.twitter.authToken config is empty");
    }

    this._trackerDuration = this._configService.get<number>('airdrop.twitter.tracker.duration');
    if (!this._trackerDuration) {
      throw new Error("airdrop.twitter.tracker.duration config is empty");
    }

    this._trackerInterval = this._configService.get<number>('airdrop.twitter.tracker.interval');
    if (!this._trackerInterval) {
      throw new Error("airdrop.twitter.tracker.interval config is empty");
    }

    this._twitterClient = new TwitterApi(this._authToken).v2.readOnly;

    const interval = setInterval(this.fetchTweetsFromPage.bind(this), this._trackerInterval);
    this._schedulerRegistry.addInterval('TweetsTrackerJob', interval);
    this.fetchTweetsFromPage();
  }

  fetchTweetsFromPage() {
    let socialLivelyQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.log(`fetch social lively: ${socialLively}`))
      )

    RxJS.from(socialLivelyQueryResultObservable).pipe(
      RxJS.switchMap((socialLively) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialEventEntity, "SocialEvent")
          .where('"SocialEvent"."trackingEndAt" > :timestamp', {timestamp: new Date()})
          .orderBy('"SocialEvent"."publishedAt"', "DESC")
          .execute()
        ).pipe(
          RxJS.switchMap((queryResult) =>
            RxJS.merge(
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => queryResult.length === 0),
                RxJS.switchMap((_) =>
                  RxJS.from(this._entityManager.createQueryBuilder(SocialEventEntity, "SocialEvent")
                    .orderBy('"SocialEvent"."publishedAt"', "DESC")
                    .limit(1)
                    .execute()
                  ).pipe(
                    RxJS.switchMap((findEventResult) =>
                      RxJS.merge(
                        RxJS.of(findEventResult).pipe(
                            RxJS.filter((findEventResult) => !!findEventResult),
                            RxJS.switchMap((socialEvent: SocialEventEntity) =>
                              RxJS.defer(() =>
                                RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                                  max_results: 100,
                                  since_id: socialEvent.contentId,
                                  "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                                }))
                              ).pipe(
                                RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                                RxJS.tap({
                                  next: (paginator) => this._logger.log(`paginator data count: ${paginator.meta.result_count}`),
                                  error: (error) => this._logger.error(`fetch tweets from twitter failed, error: ${error}`)
                                }),
                                RxJS.concatMap((paginator) =>
                                  RxJS.from(paginator.data.data).pipe(
                                    RxJS.tap((tweet: TweetV2) => this._logger.log(`get tweet, id: ${tweet.id}, tweet.referenced_tweet: ${tweet?.referenced_tweets[0]}`)),
                                    RxJS.filter((tweet: TweetV2) => !!tweet.referenced_tweets),
                                    RxJS.map((tweet: TweetV2) => {
                                      const tweetEventDto = TweetEventDto.from(tweet);
                                      const socialEvent = new SocialEventEntity();
                                      socialEvent.contentId = tweet.id;
                                      socialEvent.content = ContentDto.from(tweetEventDto);
                                      socialEvent.lang = tweet.lang;
                                      socialEvent.publishedAt = tweetEventDto.createdAt;
                                      socialEvent.contentUrl = 'https://twitter.com/' + socialLively.username + '/status/' + tweet.id;
                                      socialEvent.trackingStartedAt = moment().toDate();
                                      socialEvent.trackingEndAt = moment().add(this._trackerDuration, 's').toDate();
                                      socialEvent.trackingInterval = this._trackerInterval;
                                      socialEvent.social = socialLively;
                                      socialEvent.socialTracker = null;
                                      return socialEvent;
                                    }),
                                    RxJS.concatMap((socialEvent) =>
                                      RxJS.from(this._entityManager.createQueryBuilder()
                                        .insert()
                                        .into(SocialEventEntity)
                                        .values([socialEvent])
                                        .execute()
                                      ).pipe(
                                        RxJS.tap((insertResult) => this._logger.log(`save new social event success, tweet Id: ${socialEvent.contentId}, id: ${socialEvent.id}`)),
                                        RxJS.map((insertResult) => {
                                          return {socialLively, socialEvent};
                                        })
                                      )
                                    )
                                  )
                                ),
                                RxJS.catchError((err) =>  {
                                  if (err instanceof ApiPartialResponseError ||
                                    err instanceof ApiRequestError ||
                                    err instanceof ApiResponseError) {
                                    return RxJS.throwError(() => new TwitterApiError("twitter userTimeline api failed", err))
                                  }
                                  return RxJS.throwError (err);
                                }),
                                finalize(() => this._logger.log(`finalize twitter client userTimeline . . .`)),
                                this.retryWithDelay(30000, 3),
                              )
                            )
                          ),
                        RxJS.of(findEventResult).pipe(
                          RxJS.filter((findEventResult) => !!!findEventResult),
                          RxJS.switchMap((_) =>
                            RxJS.defer(() =>
                          RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                            max_results: 100,
                            "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                          }))
                        ).pipe(
                          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                          RxJS.tap({
                            next: (paginator) => this._logger.log(`paginator data count: ${paginator.meta.result_count}`),
                            error: (error) => this._logger.error(`fetch tweets from twitter failed, error: ${error}`)
                          }),
                          RxJS.concatMap((paginator) =>
                            RxJS.from(paginator.data.data).pipe(
                              RxJS.tap((tweet: TweetV2) => this._logger.log(`get tweet, id: ${tweet.id}, tweet.referenced_tweet: ${tweet?.referenced_tweets[0]}`)),
                              RxJS.filter((tweet: TweetV2) => !!tweet.referenced_tweets),
                              RxJS.map((tweet: TweetV2) => {
                                const tweetEventDto = TweetEventDto.from(tweet);
                                const socialEvent = new SocialEventEntity();
                                socialEvent.contentId = tweet.id;
                                socialEvent.content = ContentDto.from(tweetEventDto);
                                socialEvent.lang = tweet.lang;
                                socialEvent.publishedAt = tweetEventDto.createdAt;
                                socialEvent.contentUrl = 'https://twitter.com/' + socialLively.username + '/status/' + tweet.id;
                                socialEvent.trackingStartedAt = moment().toDate();
                                socialEvent.trackingEndAt = moment().add(this._trackerDuration, 's').toDate();
                                socialEvent.trackingInterval = this._trackerInterval;
                                socialEvent.social = socialLively;
                                socialEvent.socialTracker = null;
                                return socialEvent;
                              }),
                              RxJS.concatMap((socialEvent) =>
                                RxJS.from(this._entityManager.createQueryBuilder()
                                  .insert()
                                  .into(SocialEventEntity)
                                  .values([socialEvent])
                                  .execute()
                                ).pipe(
                                  RxJS.tap((insertResult) => this._logger.log(`save new social event success, tweet Id: ${socialEvent.contentId}, id: ${socialEvent.id}`)),
                                  RxJS.map((insertResult) => {
                                    return {socialLively, socialEvent};
                                  })
                                )
                              )
                            )
                          ),
                          RxJS.catchError((err) =>  {
                            if (err instanceof ApiPartialResponseError ||
                              err instanceof ApiRequestError ||
                              err instanceof ApiResponseError) {
                              return RxJS.throwError(() => new TwitterApiError("twitter userTimeline api failed", err))
                            }
                            return RxJS.throwError (err);
                          }),
                          finalize(() => this._logger.log(`finalize twitter client userTimeline . . .`)),
                          this.retryWithDelay(3000, 1),
                        )
                          )
                      )
                    )
                  )
                )
              ),
              ),
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => queryResult.length > 0),
                RxJS.switchMap((queryResult) =>
                  RxJS.concat(
                    RxJS.from(queryResult).pipe(
                      RxJS.map((socialEvent) => [socialLively, socialEvent])
                    ),
                    RxJS.of(queryResult[0]).pipe(
                      RxJS.switchMap((lastPublishedEvent: SocialEventEntity) =>
                        RxJS.defer(() =>
                          RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                            max_results: 100,
                            since_id: lastPublishedEvent.contentId,
                            "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                          }))
                        ).pipe(
                          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                          RxJS.tap({
                            next: (paginator) => this._logger.log(`paginator data count: ${paginator.meta.result_count}`),
                            error: (error) => this._logger.error(`fetch tweets from twitter failed, error: ${error}`)
                          }),
                          RxJS.switchMap((paginator) =>
                            RxJS.from(paginator.data.data).pipe(
                              RxJS.tap((tweet: TweetV2) => this._logger.log(`get tweet, id: ${tweet.id}, tweet.referenced_tweet: ${tweet?.referenced_tweets[0]}`)),
                              RxJS.filter((tweet: TweetV2) => !!tweet.referenced_tweets),
                              RxJS.map((tweet: TweetV2) => {
                                const tweetEventDto = TweetEventDto.from(tweet);
                                const socialEvent = new SocialEventEntity();
                                socialEvent.contentId = tweet.id;
                                socialEvent.content = ContentDto.from(tweetEventDto);
                                socialEvent.lang = tweet.lang;
                                socialEvent.publishedAt = tweetEventDto.createdAt;
                                socialEvent.contentUrl = 'https://twitter.com/' + socialLively.username + '/status/' + tweet.id;
                                socialEvent.trackingStartedAt = moment().toDate();
                                socialEvent.trackingEndAt = moment().add(this._trackerDuration, 's').toDate();
                                socialEvent.trackingInterval = this._trackerInterval;
                                socialEvent.social = socialLively;
                                socialEvent.socialTracker = null;
                                return socialEvent;
                              }),
                              RxJS.concatMap((socialEvent) =>
                                RxJS.from(this._entityManager.createQueryBuilder()
                                  .insert()
                                  .into(SocialEventEntity)
                                  .values([socialEvent])
                                  .execute()
                                ).pipe(
                                  RxJS.tap((insertResult) => this._logger.log(`save new social event success, tweet Id: ${socialEvent.contentId}, id: ${socialEvent.id}`)),
                                  RxJS.map((_) => {
                                    return {socialLively, socialEvent};
                                  })
                                )
                              )
                            )
                          ),
                          RxJS.catchError((err) =>  {
                            if (err instanceof ApiPartialResponseError ||
                              err instanceof ApiRequestError ||
                              err instanceof ApiResponseError) {
                              return RxJS.throwError(() => new TwitterApiError("twitter userTimeline api failed", err))
                            }
                            return RxJS.throwError (err);
                          }),
                          finalize(() => this._logger.log(`finalize twitter client userTimeline . . .`)),
                          this.retryWithDelay(30000, 3),
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
          RxJS.concatMap((tuple: [SocialLivelyEntity, SocialEventEntity]) =>
            RxJS.concat(
              RxJS.defer(() =>
                RxJS.from(this._twitterClient.tweetLikedBy(tuple[1].contentId, {
                  asPaginator: true,
                  "user.fields": ["id", "name", "username"]
                }))
              ).pipe(
                RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                RxJS.tap((paginator) => this._logger.log(`paginator data count: ${paginator.meta.result_count}`)),
                RxJS.switchMap((paginator) =>
                  RxJS.from(paginator.data.data).pipe(
                    RxJS.concatMap((tweetLiked:UserV2) =>
                      RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "SocialProfile")
                          .select()
                          .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                          .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
                          .getOne()
                      ).pipe(
                        RxJS.tap( {
                          next: (socialProfile) => this._logger.log(`find socialProfile related to user TweetlikedBy, tweetId: ${tuple[1].contentId}, user: ${socialProfile?.username}`),
                          error: (error) => this._logger.error(`find socialProfile related to user TweetlikedBy failed, tweetId: ${tuple[1].contentId}, error: ${error}`),
                        }),
                        RxJS.filter((socialProfile) => !!socialProfile),
                        RxJS.map((socialProfile) => {
                          const socialTracker = new SocialTrackerEntity();
                          socialTracker.actionType = SocialActionType.LIKE;
                          socialTracker.socialEvent = tuple[1];
                          socialTracker.socialProfile = socialProfile;
                          return socialTracker;
                        }),
                        RxJS.concatMap((socialTracker) =>
                          RxJS.from(this._entityManager.createQueryBuilder()
                            .insert()
                            .into(SocialTrackerEntity)
                            .values([socialTracker])
                            .execute()
                          ).pipe(
                            RxJS.tap({
                              next: (_) => this._logger.log(`save socialTracker success, tweetId: ${tuple[1].contentId}, action: ${socialTracker.actionType}, socialTracker.Id: ${socialTracker.id}`),
                              error: (error) => this._logger.error(`save socialTracker failed, tweetId: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}, error: ${error}`),
                            }),
                            RxJS.map((_) => [...tuple, socialTracker]),
                            RxJS.catchError((error) => RxJS.EMPTY)
                          )
                        )
                      )
                    )
                  )
                ),
                RxJS.catchError((err) =>  {
                  if (err instanceof ApiPartialResponseError ||
                    err instanceof ApiRequestError ||
                    err instanceof ApiResponseError) {
                    return RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err))
                  }
                  return RxJS.throwError (err);
                }),
                finalize(() => this._logger.log(`finalize twitter client tweetLikedBy . . .`)),
                this.retryWithDelay(30000, 3),
              ),
              RxJS.defer(() =>
                RxJS.from(this._twitterClient.tweetRetweetedBy(tuple[1].contentId, {
                  asPaginator: true,
                  "user.fields": ["id", "name", "username"]}))
              ).pipe(
                RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                RxJS.tap((paginator) => this._logger.log(`paginator data count: ${paginator.meta.result_count}`)),
                RxJS.switchMap((paginator) =>
                  RxJS.from(paginator.data.data).pipe(
                    RxJS.concatMap((tweetLiked:UserV2) =>
                      RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "SocialProfile")
                        .select()
                        .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                        .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
                        .getOne()
                      ).pipe(
                        RxJS.tap( {
                          next: (socialProfile) => this._logger.log(`find socialProfile related to user tweetRetweetedBy, tweetId: ${tuple[1].contentId}, user: ${socialProfile?.username}`),
                          error: (error) => this._logger.error(`find socialProfile related to user tweetRetweetedBy failed, tweetId: ${tuple[1].contentId}, error: ${error}`),
                        }),
                        RxJS.filter((socialProfile) => !!socialProfile),
                        RxJS.map((socialProfile) => {
                          const socialTracker = new SocialTrackerEntity();
                          socialTracker.actionType = SocialActionType.RETWEET;
                          socialTracker.socialEvent = tuple[1];
                          socialTracker.socialProfile = socialProfile;
                          return socialTracker;
                        }),
                        RxJS.concatMap((socialTracker) =>
                          RxJS.from(this._entityManager.createQueryBuilder()
                            .insert()
                            .into(SocialTrackerEntity)
                            .values([socialTracker])
                            .execute()
                          ).pipe(
                            RxJS.tap({
                              next: (_) => this._logger.log(`save socialTracker success, tweetId: ${tuple[1].contentId}, action: ${socialTracker.actionType}, socialTracker.Id: ${socialTracker.id}`),
                              error: (error) => this._logger.error(`save socialTracker failed, tweetId: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}, error: ${error}`),
                            }),
                            RxJS.map((_) => [...tuple, socialTracker]),
                            RxJS.catchError((error) => RxJS.EMPTY)
                          )
                        )
                      )
                    )
                  )
                ),
                RxJS.catchError((err) =>  {
                  if (err instanceof ApiPartialResponseError ||
                    err instanceof ApiRequestError ||
                    err instanceof ApiResponseError) {
                    return RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err))
                  }
                  return RxJS.throwError (err);
                }),
                finalize(() => this._logger.log(`finalize twitter client follower . . .`)),
                this.retryWithDelay(3000, 1),
              )
            )
          )
        )
      )
    ).subscribe({
      next: (tuple: [SocialLivelyEntity, SocialEventEntity, SocialTrackerEntity]) =>
        this._logger.log(`fetchTweetsFromPage tweeter social Tracker, tweetId: ${tuple[1].contentId}, user: ${tuple[2].socialProfile.username}, action: ${tuple[2].actionType}`),
      error: (err) => this._logger.error(`fetchTweetsFromPage err: ${err}`),
      complete: () => this._logger.log(`fetchTweetsFromPage completed`),
    })
  }

  public retryWithDelay<T>(delay: number, count = 1): RxJS.MonoTypeOperatorFunction<T> {
    return (input) =>
      input.pipe(
        RxJS.retryWhen((errors) =>
          errors.pipe(
            RxJS.scan((acc, error) => ({ count: acc.count + 1, error }), {
              count: 0,
              error: Error,
            }),
            RxJS.tap((current) => {
              if (!(current.error instanceof TwitterApiError) || current.count > count) {
                throw current.error;
              }
              this._logger.log(`fetch failed, retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}