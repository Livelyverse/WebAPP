import { Injectable, Logger } from "@nestjs/common";
import { EntityManager, MoreThan } from "typeorm";
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
import * as moment from 'moment';
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
        RxJS.from(this._entityManager.getRepository(SocialEventEntity)
          .find({
            where: {
              trackingEndAt: MoreThan(new Date())
            },
            order: {
              ["publishedAt"]: "DESC"
            }
          })
        ).pipe(
          RxJS.switchMap((queryResult) =>
            RxJS.merge(
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => !queryResult.length),
                RxJS.tap((_) => this._logger.log(`fetchTweets pipe(1): SocialEvent with tracker not found . . .`)),
                RxJS.switchMap((_) =>
                  RxJS.from(this._entityManager.getRepository(SocialEventEntity)
                    .find({
                      skip: 0,
                      take: 1,
                      order: {
                        ["publishedAt"]: "DESC"
                      }
                    })
                  ).pipe(
                    RxJS.switchMap((socialEventEntities) =>
                      RxJS.merge(
                        RxJS.of(socialEventEntities).pipe(
                            RxJS.filter((socialEvents) => !!socialEvents.length),
                            RxJS.map((socialEvents) => socialEvents[0]),
                            RxJS.tap((socialEvent) => this._logger.log(`fetchTweets pipe(11), latest SocialEvent found, socialEvent.contentId: ${socialEvent.contentId}`)),
                            RxJS.switchMap((socialEvent: SocialEventEntity) =>
                              RxJS.defer(() =>
                                RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                                  max_results: 100,
                                  since_id: socialEvent.contentId,
                                  "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                                }))
                              ).pipe(
                                RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                                RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                                RxJS.tap({
                                  next: (paginator) => this._logger.log(`fetchTweets pipe(11), paginator data count: ${paginator.meta.result_count}`),
                                  error: (error) => this._logger.error(`fetchTweets pipe(11), fetch tweets from twitter failed, error: ${error.stack}`)
                                }),
                                RxJS.concatMap((paginator) =>
                                  RxJS.from(paginator.data.data).pipe(
                                    RxJS.tap((tweet: TweetV2) => this._logger.log(`fetchTweets pipe(11), tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
                                    RxJS.filter((tweet: TweetV2) => !!!tweet.referenced_tweets),
                                    RxJS.map((tweet: TweetV2) => {
                                      const tweetEventDto = TweetEventDto.from(tweet);
                                      const socialEvent = new SocialEventEntity();
                                      socialEvent.contentId = tweet.id;
                                      socialEvent.content = ContentDto.from(tweetEventDto);
                                      socialEvent.lang = tweet.lang;
                                      socialEvent.publishedAt = tweetEventDto.createdAt;
                                      socialEvent.contentUrl = 'https://twitter.com/' + socialLively.username + '/status/' + tweet.id;
                                      socialEvent.trackingStartedAt = moment().toDate();
                                      socialEvent.trackingEndAt = moment().add(this._trackerDuration, 'seconds').toDate();
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
                                        RxJS.tap((insertResult) => this._logger.log(`fetchTweets pipe(11), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`)),
                                        RxJS.map((insertResult) => {
                                          return [socialLively, socialEvent];
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
                                finalize(() => this._logger.log(`fetchTweets pipe(11), finalize twitter client userTimeline . . .`)),
                                this.retryWithDelay(30000, 3),
                              )
                            )
                        ),
                        RxJS.of(socialEventEntities).pipe(
                          RxJS.filter((socialEventEntities) => !socialEventEntities.length),
                          RxJS.tap((_) => this._logger.log(`fetchTweets pipe(12), SocialEvent not found . . .`)),
                          RxJS.switchMap((_) =>
                            RxJS.defer(() =>
                              RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                                max_results: 100,
                                "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                              }))
                            ).pipe(
                              RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                              RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                              RxJS.tap({
                                next: (paginator) => this._logger.log(`fetchTweets pipe(12), paginator data count: ${paginator.meta.result_count}`),
                                error: (error) => this._logger.error(`fetchTweets pipe(12), fetch tweets from twitter failed, error: ${error.stack}`)
                              }),
                              RxJS.concatMap((paginator) =>
                                RxJS.from(paginator.data.data).pipe(
                                  RxJS.tap((tweet: TweetV2) => this._logger.log(`fetchTweets pipe(12), tweet.id: ${tweet.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
                                  RxJS.filter((tweet: TweetV2) => !!!tweet.referenced_tweets),
                                  RxJS.map((tweet: TweetV2) => {
                                    const tweetEventDto = TweetEventDto.from(tweet);
                                    const socialEvent = new SocialEventEntity();
                                    socialEvent.contentId = tweet.id;
                                    socialEvent.content = ContentDto.from(tweetEventDto);
                                    socialEvent.lang = tweet.lang;
                                    socialEvent.publishedAt = tweetEventDto.createdAt;
                                    socialEvent.contentUrl = 'https://twitter.com/' + socialLively.username + '/status/' + tweet.id;
                                    socialEvent.trackingStartedAt = moment().toDate();
                                    socialEvent.trackingEndAt = moment().add(this._trackerDuration, 'seconds').toDate();
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
                                      RxJS.tap((insertResult) => this._logger.log(`fetchTweets pipe(12), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, SocialEvent.id: ${socialEvent.id}`)),
                                      RxJS.map((insertResult) => {
                                        return [socialLively, socialEvent];
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
                              finalize(() => this._logger.log(`fetchTweets pipe(12), finalize twitter client userTimeline . . .`)),
                              this.retryWithDelay(30000, 3),
                            )
                          )
                        )
                      )
                    ),
                  )
                ),
              ),
              RxJS.of(queryResult).pipe(
                RxJS.filter((socialEventEntities) => !!socialEventEntities.length),
                RxJS.tap((socialEventEntities) => this._logger.log(`fetchTweets pipe(2): SocialEvents with tracker found, count: ${socialEventEntities.length}`)),
                RxJS.switchMap((socialEventEntities) =>
                  RxJS.concat(
                    RxJS.from(socialEventEntities).pipe(
                      RxJS.map((socialEvent) => [socialLively, socialEvent])
                    ),
                    RxJS.of(socialEventEntities[0]).pipe(
                      RxJS.switchMap((socialEvent: SocialEventEntity) =>
                        RxJS.defer(() =>
                          RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                            max_results: 100,
                            since_id: socialEvent.contentId,
                            "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                          }))
                        ).pipe(
                          RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                          RxJS.tap({
                            next: (paginator) => this._logger.log(`fetchTweets pipe(2): paginator data count: ${paginator.meta.result_count}`),
                            error: (error) => this._logger.error(`fetchTweets pipe(2): fetch tweets from twitter failed, error: ${error.stack}`)
                          }),
                          RxJS.switchMap((paginator) =>
                            RxJS.from(paginator.data.data).pipe(
                              RxJS.tap((tweet: TweetV2) => this._logger.log(`fetchTweets pipe(2): tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
                              RxJS.filter((tweet: TweetV2) => !!!tweet.referenced_tweets),
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
                                  RxJS.tap((insertResult) => this._logger.log(`fetchTweets pipe(2): save socialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.id: ${socialEvent.id}`)),
                                  RxJS.map((_) => {
                                    return [socialLively, socialEvent];
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
                          finalize(() => this._logger.log(`fetchTweets pipe(2): finalize twitter client userTimeline . . .`)),
                          this.retryWithDelay(30000, 3),
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
        )
      )
    ).subscribe({
      next: (tuple: [SocialLivelyEntity, SocialEventEntity]) =>
        this._logger.log(`fetchTweetsFromPage tweeter social Tracker, tweetId: ${tuple[1].contentId}`),
      // next: (tuple: [SocialLivelyEntity, SocialEventEntity, SocialTrackerEntity]) =>
      //   this._logger.log(`fetchTweetsFromPage tweeter social Tracker, tweetId: ${tuple[1].contentId}, user: ${tuple[2].socialProfile.username}, action: ${tuple[2].actionType}`),
      error: (err) => this._logger.error(`fetchTweetsFromPage err: ${err.stack}`),
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