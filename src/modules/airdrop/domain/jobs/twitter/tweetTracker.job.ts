import { Injectable, Logger } from "@nestjs/common";
import { EntityManager, MoreThan } from "typeorm";
import { ConfigService } from "@nestjs/config";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import { InjectEntityManager } from "@nestjs/typeorm";
import { TweetV2, TwitterApi } from "twitter-api-v2";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as RxJS from "rxjs";
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
import {
  TweetLikingUsersV2Paginator,
  TweetRetweetersUsersV2Paginator
} from "twitter-api-v2/dist/paginators/user.paginator.v2";
import { TweetUserTimelineV2Paginator } from "twitter-api-v2/dist/paginators";

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
        RxJS.tap((socialLively) => this._logger.log(`fetch social lively, socialType: ${socialLively.socialType}`))
      )

    this._logger.log("Tweets Tracker job starting . . . ");

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
                RxJS.tap((_) => this._logger.log(`pipe(1-0): SocialEvent with tracker not found . . .`)),
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
                            RxJS.tap((socialEvent) => this._logger.log(`pipe(1-1), latest SocialEvent found, socialEvent.contentId: ${socialEvent.contentId}`)),
                            RxJS.switchMap((socialEvent: SocialEventEntity) =>
                              RxJS.defer(() =>
                                 RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                                      max_results: 100,
                                      since_id: socialEvent.contentId,
                                      "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                                 }))
                              ).pipe(
                                RxJS.expand((paginator:TweetUserTimelineV2Paginator) => paginator.meta.result_count == 100 ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                                RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                                RxJS.tap({
                                  next: (paginator) => this._logger.log(`pipe(1-1), paginator data count: ${paginator.meta.result_count}`),
                                  error: (error) => this._logger.error(`pipe(1-1), fetch tweets from twitter failed, error: ${error.stack}`)
                                }),
                                RxJS.concatMap((paginator) =>
                                  RxJS.from(paginator.data.data).pipe(
                                    RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(1-1), tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
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
                                        RxJS.tap((insertResult) => this._logger.log(`pipe(11), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`)),
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
                                RxJS.finalize(() => this._logger.log(`pipe(1-1), finalize twitter client userTimeline . . .`)),
                                this.retryWithDelay(30000, 3),
                              )
                            )
                        ),
                        RxJS.of(socialEventEntities).pipe(
                          RxJS.filter((socialEventEntities) => !socialEventEntities.length),
                          RxJS.tap((_) => this._logger.log(`pipe(1-2), SocialEvent not found . . .`)),
                          RxJS.switchMap((_) =>
                            RxJS.defer(() =>
                              RxJS.from(this._twitterClient.userTimeline(socialLively.userId, {
                                max_results: 100,
                                "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source"],
                              }))
                            ).pipe(
                              RxJS.expand((paginator) => paginator.meta.result_count == 100 ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                              RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                              RxJS.tap({
                                next: (paginator) => this._logger.log(`pipe(1-2), paginator data count: ${paginator.meta.result_count}`),
                                error: (error) => this._logger.error(`pipe(1-2), fetch tweets from twitter failed, error: ${error.stack}`)
                              }),
                              RxJS.concatMap((paginator) =>
                                RxJS.from(paginator.data.data).pipe(
                                  RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(1-2), tweet.id: ${tweet.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
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
                                      RxJS.tap((insertResult) => this._logger.log(`pipe(1-2), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, SocialEvent.id: ${socialEvent.id}`)),
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
                              RxJS.finalize(() => this._logger.log(`pipe(1-2), finalize twitter client userTimeline . . .`)),
                              this.retryWithDelay(30000, 3),
                            )
                          )
                        )
                      )
                    ),
                    RxJS.retryWhen((errors) =>
                      errors.pipe(
                        RxJS.takeWhile((err) => {
                          if (!(err instanceof ApiResponseError && err.code === 429)) {
                            throw err;
                          }
                          return true
                        }),
                        RxJS.tap({
                          next: (paginator) => this._logger.log(`tweeter client rate limit exceeded, retry for 15 minutes later`),
                        }),
                        RxJS.delay(960000)
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
                    RxJS.finalize(() => this._logger.log(`pipe(1-0), finalize twitter client userTimeline . . .`)),
                    this.retryWithDelay(30000, 3),
                  )
                ),
              ),
              RxJS.of(queryResult).pipe(
                RxJS.filter((socialEventEntities) => !!socialEventEntities.length),
                RxJS.tap((socialEventEntities) => this._logger.log(`pipe(2): SocialEvents with tracker found, count: ${socialEventEntities.length}`)),
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
                          RxJS.expand((paginator) => paginator.meta.result_count == 100 ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                          RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                          RxJS.tap({
                            next: (paginator) => this._logger.log(`pipe(2): paginator data count: ${paginator.meta.result_count}`),
                            error: (error) => this._logger.error(`pipe(2): fetch tweets from twitter failed, error: ${error}`)
                          }),
                          RxJS.concatMap((paginator) =>
                            RxJS.from(paginator.data.data).pipe(
                              RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(2): tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}`)),
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
                                  RxJS.tap((insertResult) => this._logger.log(`pipe(2): save socialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.id: ${socialEvent.id}`)),
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
                          RxJS.finalize(() => this._logger.log(`pipe(2): finalize twitter client userTimeline . . .`)),
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
                RxJS.expand((paginator) => {
                  return paginator.meta.result_count == 100 ? RxJS.from(paginator.next()) : RxJS.EMPTY
                }),
                RxJS.tap({
                  error: (error) => this._logger.error(`pipe(3-0): paginator failed, tweet.Id: ${tuple[1].contentId}\n${error}`)
                }),
                RxJS.concatMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                      RxJS.tap({
                        next: (paginator) => this._logger.log(`pipe(3-0): paginator rate limit not exceeded, tweet.Id: ${tuple[1].contentId}, remaining: ${paginator.rateLimit.remaining}`),
                      })
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                      RxJS.tap({
                        next: (paginator) => this._logger.log(`pipe(3-0): paginator rate limit exceeded, tweet.Id: ${tuple[1].contentId}, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                      }),
                      RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
                    )
                  )
                ),
                RxJS.mergeMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.tap((paginator) => this._logger.log(`pipe(3-1): tweet Liked found, tweet.Id: ${tuple[1].contentId}, count: ${paginator.meta.result_count}`)),
                      RxJS.concatMap((paginator) =>
                        RxJS.from(paginator.data.data).pipe(
                          RxJS.concatMap((tweetLiked:UserV2) =>
                            RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                                .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                                .addSelect('"sub"."tid" as "trackerId"')
                                .addSelect('"sub"."eid" as "eventId"')
                                .leftJoin(qb =>
                                  qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                                    .from(SocialProfileEntity, "profile")
                                    .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                                    .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                                    .where('"event"."contentId" = :contentId', {contentId: tuple[1].contentId})
                                    .andWhere('"tracker"."actionType" = \'LIKE\'')
                                    .andWhere('"profile"."username" = :username', {username: tweetLiked.username})
                                    .andWhere('"profile"."socialType" = :socialType', {socialType: tuple[0].socialType}),
                                  "sub", '"sub"."pid" = "socialProfile"."id"')
                                .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                                .getRawOne()
                            // RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                            //   .select('"socialTracker"."id" as "trackerId"')
                            //   .addSelect('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                            //   .addSelect('"sub"."socialEventId" as "eventId"')
                            //   // .from(qb =>
                            //   //   qb.select('"socialEvent"."id" as "socialEventId"')
                            //   //     .from(SocialEventEntity, "socialEvent")
                            //   //     .where('"socialEvent"."contentId" = :contentId', {contentId: tuple[1].contentId}), "socialEvent")
                            //   // .addFrom(SocialProfileEntity, "socialProfile")
                            //   .leftJoin("social_tracker", "socialTracker", '"socialProfile"."id" = "socialTracker"."socialProfileId"')
                            //   .leftJoin(qb =>
                            //     qb.select('"socialEvent"."id" as "socialEventId", "socialTracker"."id" as "socialTrackerId"')
                            //       .from(SocialEventEntity, "socialEvent")
                            //       .innerJoin("social_tracker", "socialTracker", '"socialTracker"."socialEventId" = "socialEvent"."id"')
                            //       .where('"socialEvent"."contentId" = :contentId', {contentId: tuple[1].contentId})
                            //       .andWhere('"socialTracker"."actionType" = \'LIKE\''),
                            //     "sub", '"socialTracker"."socialEventId" = "sub"."socialEventId"')
                            //   .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                            //   .andWhere('"socialProfile"."socialType" = :socialType', {socialType: tuple[0].socialType})
                            //   .getRawOne()
                            ).pipe(
                              RxJS.tap( {
                                error: (error) => this._logger.error(`pipe(3-1): find socialProfile and socialTracker failed, tweet.Id: ${tuple[1].contentId}, error: ${error}`),
                              }),
                              RxJS.mergeMap((queryResult) =>
                                RxJS.merge(
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!!queryResult ),
                                    RxJS.tap( {
                                      next: (_) => this._logger.log(`pipe(3-1): socialProfile and socialTracker not found, tweet.Id: ${tuple[1].contentId}, username: ${tweetLiked.username}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((data) => !!data && data.trackerId && data.eventId),
                                    RxJS.tap( {
                                      next: (data) => this._logger.log(`pipe(3-1): socialTracker already exists, tweet.Id: ${tuple[1].contentId}, socialTracker.id: ${data.trackerId}, socialProfile.username: ${data.profileUsername}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((data) => !!data && !data.eventId && data.profileId),
                                    RxJS.tap( {
                                      next: (data) => this._logger.log(`pipe(3-1): socialProfile found, tweet.Id: ${tuple[1].contentId}, socialProfile.username: ${data.profileUsername}`),
                                    }),
                                  )
                                )
                              ),
                              RxJS.map((data) => {
                                const socialProfile = new SocialProfileEntity();
                                socialProfile.id = data.profileId;
                                socialProfile.username = data.profileUsername;
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
                                    next: (_) => this._logger.log(`pipe(3-1): save socialTracker success, tweet.Id: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}`),
                                    error: (error) => this._logger.error(`pipe(3-1): save socialTracker failed, tweet.Id: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}, error: ${error}`),
                                  }),
                                )
                              )
                            )
                          )
                        )
                      ),
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.data.meta.result_count),
                      RxJS.tap((_) => this._logger.log(`pipe(3-2): tweet Liked not found, tweet.Id: ${tuple[1].contentId}`)),
                    )
                  )
                ),
                RxJS.retryWhen((errors) =>
                  errors.pipe(
                    RxJS.takeWhile((err) => {
                      if (!(err instanceof ApiResponseError && err.code === 429)) {
                        throw err;
                      }
                      return true
                    }),
                    RxJS.tap({
                      next: (paginator) => this._logger.log(`pipe(3-0): tweeter client rate limit exceeded, retry for 15 minutes later`),
                    }),
                    RxJS.delay(960000)
                  )
                ),
                RxJS.catchError((err) =>  {
                  if (err instanceof ApiPartialResponseError ||
                    err instanceof ApiRequestError ||
                    err instanceof ApiResponseError) {
                    return RxJS.throwError(() => new TwitterApiError("twitter tweetLikedBy api failed", err))
                  }
                  return RxJS.throwError(err);
                }),
                RxJS.finalize(() => this._logger.log(`pipe(3-0): finalize twitter client tweetLikedBy, tweet.id: ${tuple[1].contentId}`)),
                this.retryWithDelay(30000, 3),
              ),
              RxJS.defer(() =>
                RxJS.from(this._twitterClient.tweetRetweetedBy(tuple[1].contentId, {
                  asPaginator: true,
                  "user.fields": ["id", "name", "username"]
                }))
              ).pipe(
                RxJS.expand((paginator: TweetRetweetersUsersV2Paginator) => paginator.meta.result_count == 100 ? RxJS.from(paginator.next()) : RxJS.EMPTY),
                RxJS.tap({
                  error: (error) => this._logger.error(`pipe(4-0): paginator failed, tweet.Id: ${tuple[1].contentId}\n${error}`)
                }),
                RxJS.concatMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                      RxJS.tap({
                        next: (paginator) => this._logger.log(`pipe(4-0): paginator rate limit not exceeded, tweet.Id: ${tuple[1].contentId}, remaining: ${paginator.rateLimit.remaining}`),
                      })
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                      RxJS.tap({
                        next: (paginator) => this._logger.log(`pipe(4-0): paginator rate limit exceeded, tweet.Id: ${tuple[1].contentId}, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                      }),
                      RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
                    )
                  )
                ),
                RxJS.mergeMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.tap((paginator) => this._logger.log(`pipe(4-1): tweet retweet found, tweet.Id: ${tuple[1].contentId}, count: ${paginator.meta.result_count}`)),
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.concatMap((paginator) =>
                        RxJS.from(paginator.data.data).pipe(
                          RxJS.concatMap((tweetLiked:UserV2) =>
                            RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                              .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                              .addSelect('"sub"."tid" as "trackerId"')
                              .addSelect('"sub"."eid" as "eventId"')
                              .leftJoin(qb =>
                                  qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                                    .from(SocialProfileEntity, "profile")
                                    .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                                    .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                                    .where('"event"."contentId" = :contentId', {contentId: tuple[1].contentId})
                                    .andWhere('"tracker"."actionType" = \'RETWEET\'')
                                    .andWhere('"profile"."username" = :username', {username: tweetLiked.username})
                                    .andWhere('"profile"."socialType" = :socialType', {socialType: tuple[0].socialType}),
                                "sub", '"sub"."pid" = "socialProfile"."id"')
                              .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                              .getRawOne()
                            ).pipe(
                              RxJS.tap( {
                                error: (error) => this._logger.error(`pipe(4-1): find socialProfile and socialTracker failed, tweet.Id: ${tuple[1].contentId}, error: ${error}`),
                              }),
                              RxJS.mergeMap((queryResult) =>
                                RxJS.merge(
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!!queryResult ),
                                    RxJS.tap( {
                                      next: (_) => this._logger.log(`pipe(4-1): socialProfile and socialTracker not found, tweet.Id: ${tuple[1].contentId}, username: ${tweetLiked.username}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((data) => !!data && data.trackerId && data.eventId),
                                    RxJS.tap( {
                                      next: (data) => this._logger.log(`pipe(4-1): socialTracker already exists, tweet.Id: ${tuple[1].contentId}, socialTracker.id: ${data.trackerId}, socialProfile.username: ${data.profileUsername}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((data) => !!data && !data.eventId && data.profileId),
                                    RxJS.tap( {
                                      next: (data) => this._logger.log(`pipe(4-1): socialProfile found, tweet.Id: ${tuple[1].contentId}, socialProfile.username: ${data.profileUsername}`),
                                    }),
                                  )
                                )
                              ),
                              RxJS.map((data) => {
                                const socialProfile = new SocialProfileEntity();
                                socialProfile.id = data.profileId;
                                socialProfile.username = data.profileUsername;
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
                                    next: (_) => this._logger.log(`pipe(4-1): save socialTracker success, tweet.Id: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}`),
                                    error: (error) => this._logger.error(`pipe(4-1): save socialTracker failed, tweet.Id: ${tuple[1].contentId}, action: ${socialTracker.actionType}, user: ${socialTracker.socialProfile.username}\n${error}`),
                                  }),
                                )
                              )
                            )
                          )
                        )
                      ),
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.data.meta.result_count),
                      RxJS.tap((_) => this._logger.log(`pipe(4-2): tweet retweet not found, tweet.Id: ${tuple[1].contentId}`)),
                    )
                  )
                ),
                RxJS.retryWhen((errors) =>
                  errors.pipe(
                    RxJS.takeWhile((err) => {
                      if (!(err instanceof ApiResponseError && err.code === 429)) {
                        throw err;
                      }
                      return true
                    }),
                    RxJS.tap({
                      next: (paginator) => this._logger.log(`pipe(4-0): tweeter client rate limit exceeded, retry for 15 minutes later`),
                    }),
                    RxJS.delay(960000)
                  )
                ),
                RxJS.catchError((err) =>  {
                  if (err instanceof ApiPartialResponseError ||
                    err instanceof ApiRequestError ||
                    err instanceof ApiResponseError) {
                    return RxJS.throwError(() => new TwitterApiError("twitter tweetRetweetedBy api failed", err))
                  }
                  return RxJS.throwError(err);
                }),
                RxJS.finalize(() => this._logger.log(`pipe(4-0): finalize twitter client tweetRetweetedBy, tweet.id: ${tuple[1].contentId}`)),
                this.retryWithDelay(30000, 3),
              )
            )
          )
        )
      ),
      RxJS.retryWhen((errors) =>
        errors.pipe(
          RxJS.takeWhile((err) => {
            if (!(err instanceof ApiResponseError && err.code === 429)) {
              throw err;
            }
            return true
          }),
          RxJS.tap({
            next: (paginator) => this._logger.log(`tweeter client rate limit exceeded, retry for 15 minutes later`),
          }),
          RxJS.delay(960000)
        )
      ),
    ).subscribe({
      error: (err) => this._logger.error(`fetchTweetsFromPage failed, ${err.stack},\n${err?.cause?.stack}`),
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
              this._logger.log(`fetch tweets failed, retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}