import { Injectable, Logger } from "@nestjs/common";
import { Brackets, EntityManager, MoreThan } from "typeorm";
import { ConfigService } from "@nestjs/config";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import { InjectEntityManager } from "@nestjs/typeorm";
import { TweetV2, TwitterApi } from "twitter-api-v2";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { SocialEventEntity } from "../../entity/socialEvent.entity";
import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { TwitterApiError } from "../../error/twitterApi.error";
import { TweetEventDto } from "../../dto/tweetEvent.dto";
import { ContentDto } from "../../dto/content.dto";
import { UserV2 } from "twitter-api-v2/dist/types/v2/user.v2.types";
import { SocialProfileEntity, SocialType } from "../../../../profile/domain/entity/socialProfile.entity";
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialActionType } from "../../entity/enums";
import {
  TweetLikingUsersV2Paginator,
  TweetRetweetersUsersV2Paginator
} from "twitter-api-v2/dist/paginators/user.paginator.v2";
import { TweetUserTimelineV2Paginator } from "twitter-api-v2/dist/paginators";
import { SocialAirdropRuleEntity } from "../../entity/socialAirdropRule.entity";
import { SocialAirdropEntity } from "../../entity/socialAirdrop.entity";
import { TrackerError } from "../../error/tracker.error";
import { TypeORMError } from "typeorm/error/TypeORMError";
import { SocialAirdropScheduleEntity } from "../../entity/socialAirdropSchedule.entity";

@Injectable()
export class TweetTrackerJob {
  private readonly _logger = new Logger(TweetTrackerJob.name);
  private readonly _authToken: string;
  private readonly _twitterClient: TwitterApiv2ReadOnly;
  private readonly _trackerInterval: number;
  private _isRunning: boolean;

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

    this._trackerInterval = this._configService.get<number>('airdrop.twitter.tracker.interval');
    if (!this._trackerInterval) {
      throw new Error("airdrop.twitter.tracker.interval config is empty");
    }

    this._twitterClient = new TwitterApi(this._authToken).v2.readOnly;
    this._isRunning = false;
    const interval = setInterval(this.fetchTweetsFromPage.bind(this), this._trackerInterval);
    this._schedulerRegistry.addInterval('TwitterTweetTrackerJob', interval);
    this.fetchTweetsFromPage();
  }

  private fetchTweetsFromPage() {
    if(!this._isRunning) {
      this._isRunning = true;
    } else {
      this._logger.warn("fetchTweetsFromPage is already running . . .");
      return;
    }

    const airdropScheduleQueryResultObservable = RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
      .findOneOrFail({
        relations: {
          socialLively: true
        },
        loadEagerRelations: true,
        where: {
          socialLively: {
            socialType: SocialType.TWITTER,
            isActive: true,
          },
          airdropEndAt: MoreThan(new Date())
        }
      })
    ).pipe(
        RxJS.tap({
          next: (airdropSchedule) => this._logger.debug(`fetch airdrop schedule success, socialType: ${airdropSchedule.socialLively.socialType}`),
          error: (err) => this._logger.error(`find airdrop schedule tweeter failed`, err)
        }),
        RxJS.catchError(err => RxJS.throwError(() => new TrackerError('fetch twitter airdrop schedule failed', err)))
      )

    this._logger.debug("Tweets Tracker job starting . . . ");

    RxJS.from(airdropScheduleQueryResultObservable).pipe(
      // fetch social lively airdrop twitter rules
      RxJS.mergeMap((airdropSchedule) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
          .select()
          .where('"airdropRule"."socialType" = \'TWITTER\'')
          .andWhere(new Brackets((qb) => {
              qb.where('"airdropRule"."actionType" = \'LIKE\'').
              orWhere('"airdropRule"."actionType" = \'RETWEET\'')
            }),
          )
          .getMany()
        ).pipe(
          RxJS.tap({
            next: (airdropRules) => airdropRules.forEach(airdropRule => this._logger.debug(`tweeter tracker airdrop rule found, actionType: ${airdropRule.actionType}, token: ${airdropRule.unit},  amount: ${airdropRule.amount}, decimal: ${airdropRule.decimal}`)),
            error: (err) => this._logger.error(`find tweeter tracker airdrop rule failed`, err)
          }),
          RxJS.mergeMap((airdropRules) =>
            RxJS.merge(
              RxJS.of(airdropRules).pipe(
                RxJS.filter((airdropRules) => airdropRules.length == 2),
                RxJS.mergeMap((airdropRules) =>
                  RxJS.merge(
                    RxJS.of(airdropRules).pipe(
                      RxJS.filter((airdropRules) => airdropRules[0].actionType == SocialActionType.LIKE),
                      RxJS.map((airdropRules) => ({airdropSchedule, airdropLikeRule: airdropRules[0], airdropRetweetRule: airdropRules[1]}))
                    ),
                    RxJS.of(airdropRules).pipe(
                      RxJS.filter((airdropRules) => airdropRules[1].actionType == SocialActionType.LIKE),
                      RxJS.map((airdropRules) => ({airdropSchedule, airdropLikeRule: airdropRules[1], airdropRetweetRule: airdropRules[0]}))
                    )
                  )
                )
              ),
              RxJS.of(airdropRules).pipe(
                RxJS.filter((airdropRules) => airdropRules.length != 2),
                RxJS.mergeMap((_) => RxJS.throwError(() => new TrackerError("tweeter tracker airdrop rules not found", null)))
              )
            )
          ),
          RxJS.tap({
            error: (err) => this._logger.error(`fetch twitter airdrop rules failed`, err)
          }),
          RxJS.catchError(err => RxJS.throwError(() => new TrackerError('fetch twitter airdrop rules failed', err)))
        )
      ),
      // fetch twitter events from db which airdropEndAt greater than now
      RxJS.switchMap((data) =>
        RxJS.from(this._entityManager.getRepository(SocialEventEntity)
          .find({
            relations: {
              airdropSchedule: true
            },
            join: {
              alias: "socialEvent",
              innerJoinAndSelect: {
                airdropSchedule: "socialEvent.airdropSchedule",
                socialLively: "airdropSchedule.socialLively"
              }
            },
            where: {
              airdropSchedule: {
                airdropEndAt: MoreThan(new Date()),
                socialLively: {
                  socialType: SocialType.TWITTER,
                }
              }
            },
            order: {
              ["publishedAt"]: "DESC"
            }
          })
        ).pipe(
          RxJS.switchMap((queryResult) =>
            RxJS.merge(
              //SocialEvent with active tracker not found
              RxJS.of(queryResult).pipe(
                RxJS.filter((queryResult) => !queryResult.length),
                RxJS.tap((_) => this._logger.log(`pipe(1-0): SocialEvent with active schedule not found . . .`)),
                RxJS.switchMap((_) =>
                  // fetch at least one twitter event from db
                  RxJS.from(this._entityManager.getRepository(SocialEventEntity).find({
                      relations: {
                        airdropSchedule: true
                      },
                      join: {
                        alias: "socialEvent",
                        innerJoinAndSelect: {
                          airdropSchedule: "socialEvent.airdropSchedule",
                          socialLively: "airdropSchedule.socialLively"
                        }
                      },
                      where: {
                        airdropSchedule: {
                          socialLively: {
                            socialType: SocialType.TWITTER,
                          }
                        }
                      },
                      order: {
                        ["publishedAt"]: "DESC"
                      },
                      skip: 0,
                      take: 1,
                    })
                  ).pipe(
                    RxJS.tap({
                      error: err => this._logger.error(`find social events failed`, err)
                    }),
                    RxJS.switchMap((socialEventEntities) =>
                      RxJS.merge(
                        // at least one SocialEvent found
                        RxJS.of(socialEventEntities).pipe(
                            RxJS.filter((socialEvents) => !!socialEvents.length),
                            RxJS.map((socialEvents) => socialEvents[0]),
                            RxJS.tap((socialEvent) => this._logger.debug(`pipe(1-1), latest SocialEvent found, socialEvent.contentId: ${socialEvent.contentId}`)),
                            // fetch tweet events from Twitter from the latest event content.Id which exists in db
                            RxJS.switchMap((socialEvent: SocialEventEntity) =>
                              RxJS.defer(() =>
                                 RxJS.from(this._twitterClient.userTimeline(data.airdropSchedule.socialLively.userId, {
                                      max_results: 100,
                                      since_id: socialEvent.contentId,
                                      "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source", "entities"],
                                 }))
                              ).pipe(
                                RxJS.expand((paginator:TweetUserTimelineV2Paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
                                RxJS.tap({
                                  next: (paginator) => this._logger.debug(`pipe(1-1), paginator data count: ${paginator.meta.result_count}`),
                                  error: (error) => this._logger.error(`pipe(1-1): paginator failed, socialEvent.contentId: ${socialEvent.contentId}`, error)
                                }),
                                RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                                RxJS.concatMap((paginator) =>
                                  RxJS.from(paginator.data.data).pipe(
                                    RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(1-1), tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}, hashtags: ${tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag], [])}`)),
                                    RxJS.filter((tweet: TweetV2) => !tweet.referenced_tweets && tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag.toLowerCase()], [])?.find(tag => tag == data.airdropSchedule.hashtags.airdrop.toLowerCase())),
                                    RxJS.map((tweet: TweetV2) => {
                                      const tweetEventDto = TweetEventDto.from(tweet);
                                      const socialEvent = new SocialEventEntity();
                                      socialEvent.contentId = tweet.id;
                                      socialEvent.content = ContentDto.from(tweetEventDto);
                                      socialEvent.lang = tweet.lang;
                                      socialEvent.publishedAt = tweetEventDto?.createdAt ? new Date(tweetEventDto?.createdAt) : new Date();
                                      socialEvent.contentUrl = 'https://twitter.com/' + data.airdropSchedule.socialLively.username + '/status/' + tweet.id;
                                      socialEvent.airdropSchedule = data.airdropSchedule;
                                      return socialEvent;
                                    }),
                                    RxJS.concatMap((socialEvent) =>
                                      RxJS.from(this._entityManager.createQueryBuilder()
                                        .insert()
                                        .into(SocialEventEntity)
                                        .values([socialEvent])
                                        .execute()
                                      ).pipe(
                                        RxJS.tap({
                                          next: (_)=> this._logger.log(`pipe(1-1), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`),
                                          error: err => this._logger.error(`pipe(1-1), save SocialEvent failed, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`, err),
                                        }),
                                        RxJS.map((_) => ({socialEvent, ...data})),
                                        RxJS.catchError(error => RxJS.throwError(() => new TrackerError('save SocialEvent failed', error)))
                                      )
                                    )
                                  )
                                ),
                                RxJS.retry({
                                  delay: (error) =>
                                    RxJS.merge(
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                                        RxJS.tap({
                                          next: (paginator) => this._logger.warn(`pipe(1-1): tweeter client (userTimeline) rate limit exceeded, retry for 15 minutes later`),
                                        }),
                                        RxJS.delay(960000)
                                      ),
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                                        RxJS.mergeMap(err => RxJS.throwError(err))
                                      ),
                                    )
                                }),
                                RxJS.tap({
                                  error: err => this._logger.error(`pipe(1-0): twitter client userTimeline failed`, err)
                                }),
                                RxJS.catchError((error) =>
                                  RxJS.merge(
                                    RxJS.of(error).pipe(
                                      RxJS.filter(err =>
                                        err instanceof ApiPartialResponseError ||
                                        err instanceof ApiRequestError ||
                                        err instanceof ApiResponseError
                                      ),
                                      RxJS.mergeMap(err => RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err)))
                                    ),
                                    RxJS.of(error).pipe(
                                      RxJS.filter(err => err instanceof TrackerError),
                                      RxJS.mergeMap(err => RxJS.throwError(err))
                                    ),
                                    RxJS.of(error).pipe(
                                      RxJS.filter(err =>
                                        !(err instanceof TrackerError ||
                                          err instanceof ApiPartialResponseError ||
                                          err instanceof ApiRequestError ||
                                          err instanceof ApiResponseError) &&
                                        err instanceof Error),
                                      RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('twitter fetch tweet like failed', err)))
                                    )
                                  )
                                ),
                                RxJS.finalize(() => this._logger.debug(`pipe(1-1), finalize twitter client userTimeline . . .`)),
                                this.retryWithDelay(30000, 3),
                              )
                            )
                        ),
                        // SocialEvent not found
                        RxJS.of(socialEventEntities).pipe(
                          RxJS.filter((socialEventEntities) => !socialEventEntities.length),
                          RxJS.tap((_) => this._logger.log(`pipe(1-2): SocialEvent not found . . .`)),
                          // fetch all tweet events from Twitter from startAt until endAt
                          RxJS.switchMap((_) =>
                            RxJS.defer(() =>
                              RxJS.from(this._twitterClient.userTimeline(data.airdropSchedule.socialLively.userId, {
                                max_results: 100,
                                start_time: data.airdropSchedule.airdropStartAt.toISOString(),
                                "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source", "entities"],
                              }))
                            ).pipe(
                              RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
                              RxJS.tap({
                                next: (paginator) => this._logger.debug(`pipe(1-2), paginator data count: ${paginator.meta.result_count}`),
                                error: (error) => this._logger.error(`pipe(1-2): paginator failed, data.airdropSchedule.socialLively.userId: ${data.airdropSchedule.socialLively.userId}`, error)
                              }),
                              RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                              RxJS.concatMap((paginator) =>
                                RxJS.from(paginator.data.data).pipe(
                                  RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(1-2), tweet.id: ${tweet.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}, hashtags: ${tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag], [])}`)),
                                  RxJS.filter((tweet: TweetV2) => !tweet.referenced_tweets && tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag.toLowerCase()], [])?.find(tag => tag == data.airdropSchedule.hashtags.airdrop.toLowerCase())),
                                  RxJS.map((tweet: TweetV2) => {
                                    const tweetEventDto = TweetEventDto.from(tweet);
                                    const socialEvent = new SocialEventEntity();
                                    socialEvent.contentId = tweet.id;
                                    socialEvent.content = ContentDto.from(tweetEventDto);
                                    socialEvent.lang = tweet.lang;
                                    socialEvent.publishedAt = tweetEventDto?.createdAt ? new Date(tweetEventDto?.createdAt) : new Date();
                                    socialEvent.contentUrl = 'https://twitter.com/' + data.airdropSchedule.socialLively.username + '/status/' + tweet.id;
                                    socialEvent.airdropSchedule = data.airdropSchedule;
                                    return socialEvent;
                                  }),
                                  RxJS.concatMap((socialEvent) =>
                                    RxJS.from(this._entityManager.createQueryBuilder()
                                      .insert()
                                      .into(SocialEventEntity)
                                      .values([socialEvent])
                                      .execute()
                                    ).pipe(
                                      RxJS.tap({
                                        next: (_)=> this._logger.log(`pipe(1-2), save SocialEvent success, tweet.Id: ${socialEvent.contentId}, SocialEvent.id: ${socialEvent.id}`),
                                        error: err => this._logger.error(`pipe(1-2), save SocialEvent failed, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`, err),
                                      }),
                                      RxJS.map((insertResult) => ({socialEvent, ...data})),
                                      RxJS.catchError(error => RxJS.throwError(() => new TrackerError('save SocialEvent failed', error)))
                                    )
                                  )
                                )
                              ),
                              RxJS.retry({
                                delay: (error) =>
                                  RxJS.merge(
                                    RxJS.of(error).pipe(
                                      RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                                      RxJS.tap({
                                        next: (paginator) => this._logger.warn(`pipe(1-2): tweeter client (userTimeline) rate limit exceeded, retry for 15 minutes later`),
                                      }),
                                      RxJS.delay(960000)
                                    ),
                                    RxJS.of(error).pipe(
                                      RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                                      RxJS.mergeMap(err => RxJS.throwError(err))
                                    ),
                                  )
                              }),
                              RxJS.tap({
                                error: err => this._logger.error(`pipe(1-2): twitter client userTimeline failed`, err)
                              }),
                              RxJS.catchError((error) =>
                                RxJS.merge(
                                  RxJS.of(error).pipe(
                                    RxJS.filter(err =>
                                      err instanceof ApiPartialResponseError ||
                                      err instanceof ApiRequestError ||
                                      err instanceof ApiResponseError
                                    ),
                                    RxJS.mergeMap(err => RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err)))
                                  ),
                                  RxJS.of(error).pipe(
                                    RxJS.filter(err => err instanceof TrackerError),
                                    RxJS.mergeMap(err => RxJS.throwError(err))
                                  ),
                                  RxJS.of(error).pipe(
                                    RxJS.filter(err =>
                                      !(err instanceof TrackerError ||
                                        err instanceof ApiPartialResponseError ||
                                        err instanceof ApiRequestError ||
                                        err instanceof ApiResponseError) &&
                                      err instanceof Error),
                                    RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('twitter fetch tweets failed', err)))
                                  )
                                )
                              ),
                              RxJS.finalize(() => this._logger.debug(`pipe(1-2), finalize twitter client userTimeline . . .`)),
                              this.retryWithDelay(30000, 3),
                            )
                          )
                        )
                      )
                    ),
                    RxJS.tap({
                      error: err => this._logger.error(`pipe(1-0), finalize twitter client userTimeline failed`, err)
                    }),
                    RxJS.catchError((error) =>
                      RxJS.merge(
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof TrackerError),
                          RxJS.mergeMap(err => RxJS.throwError(err))
                        ),
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof TypeORMError),
                          RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('fetch sorted social event failed', err)))
                        ),
                        RxJS.of(error).pipe(
                          RxJS.filter(err =>
                            !(err instanceof TrackerError || TypeORMError) && err instanceof Error),
                          RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('fetch sorted social event failed', err)))
                        )
                      )
                    ),
                    RxJS.finalize(() => this._logger.debug(`pipe(1-0), finalize twitter client userTimeline . . .`)),
                    this.retryWithDelay(30000, 3),
                  )
                ),
              ),
              // SocialEvents with tracker found
              RxJS.of(queryResult).pipe(
                RxJS.filter((socialEventEntities) => !!socialEventEntities.length),
                RxJS.tap((socialEventEntities) => this._logger.debug(`pipe(2-0): SocialEvents with tracker found, count: ${socialEventEntities.length}`)),
                RxJS.switchMap((socialEventEntities) =>
                  RxJS.concat(
                    RxJS.from(socialEventEntities).pipe(
                      RxJS.map((socialEvent) => ({socialEvent, ...data}))
                    ),
                    RxJS.of(socialEventEntities[0]).pipe(
                      RxJS.switchMap((socialEvent: SocialEventEntity) =>
                        RxJS.defer(() =>
                          RxJS.from(this._twitterClient.userTimeline(data.airdropSchedule.socialLively.userId, {
                            max_results: 100,
                            since_id: socialEvent.contentId,
                            "tweet.fields": ["id", "public_metrics", "conversation_id", "lang", "referenced_tweets", "created_at", "source", "entities"],
                          }))
                        ).pipe(
                          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
                          RxJS.tap({
                            next: (paginator) => this._logger.debug(`pipe(2-0): paginator data count: ${paginator.meta.result_count}`),
                            error: (error) => this._logger.error(`pipe(2-0): paginator failed, socialEvent.contentId: ${socialEvent.contentId}`, error)
                          }),
                          RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                          RxJS.concatMap((paginator) =>
                            RxJS.from(paginator.data.data).pipe(
                              RxJS.tap((tweet: TweetV2) => this._logger.log(`pipe(2-0): tweet.id: ${tweet?.id}, tweet.referenced_tweet: ${JSON.stringify(tweet?.referenced_tweets)}, hashtags: ${tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag], [])}`)),
                              RxJS.filter((tweet: TweetV2) => !tweet.referenced_tweets && tweet?.entities?.hashtags?.reduce((acc, hashtag) => [...acc, hashtag.tag.toLowerCase()], [])?.find(tag => tag == data.airdropSchedule.hashtags.airdrop.toLowerCase())),
                              RxJS.map((tweet: TweetV2) => {
                                const tweetEventDto = TweetEventDto.from(tweet);
                                const socialEvent = new SocialEventEntity();
                                socialEvent.contentId = tweet.id;
                                socialEvent.content = ContentDto.from(tweetEventDto);
                                socialEvent.lang = tweet.lang;
                                socialEvent.publishedAt = tweetEventDto?.createdAt ? new Date(tweetEventDto?.createdAt) : new Date();
                                socialEvent.contentUrl = 'https://twitter.com/' + data.airdropSchedule.socialLively.username + '/status/' + tweet.id;
                                socialEvent.airdropSchedule = data.airdropSchedule;
                                return socialEvent;
                              }),
                              RxJS.concatMap((socialEvent) =>
                                RxJS.from(this._entityManager.createQueryBuilder()
                                  .insert()
                                  .into(SocialEventEntity)
                                  .values([socialEvent])
                                  .execute()
                                ).pipe(
                                  RxJS.tap({
                                    next: (_)=> this._logger.log(`pipe(2-0): save socialEvent success, tweet.Id: ${socialEvent.contentId}, socialEvent.id: ${socialEvent.id}`),
                                    error: err => this._logger.log(`pipe(2-0): save SocialEvent failed, tweet.Id: ${socialEvent.contentId}, socialEvent.Id: ${socialEvent.id}`, err),
                                  }),
                                  RxJS.map((_) => ({socialEvent, ...data})),
                                  RxJS.catchError(error => RxJS.throwError(() => new TrackerError('save SocialEvent failed', error)))
                                )
                              )
                            )
                          ),
                          RxJS.retry({
                            delay: (error) =>
                              RxJS.merge(
                                RxJS.of(error).pipe(
                                  RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                                  RxJS.tap({
                                    next: (paginator) => this._logger.warn(`pipe(2-0): tweeter client (userTimeline) rate limit exceeded, retry for 15 minutes later`),
                                  }),
                                  RxJS.delay(960000)
                                ),
                                RxJS.of(error).pipe(
                                  RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                                  RxJS.mergeMap(err => RxJS.throwError(err))
                                ),
                              )
                          }),
                          RxJS.tap({
                            error: err => this._logger.error(`pipe(2-0): twitter client userTimeline failed`, err)
                          }),
                          RxJS.catchError((error) =>
                            RxJS.merge(
                              RxJS.of(error).pipe(
                                RxJS.filter(err =>
                                  err instanceof ApiPartialResponseError ||
                                  err instanceof ApiRequestError ||
                                  err instanceof ApiResponseError
                                ),
                                RxJS.mergeMap(err => RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err)))
                              ),
                              RxJS.of(error).pipe(
                                RxJS.filter(err => err instanceof TrackerError),
                                RxJS.mergeMap(err => RxJS.throwError(err))
                              ),
                              RxJS.of(error).pipe(
                                RxJS.filter(err =>
                                  !(err instanceof TrackerError ||
                                    err instanceof ApiPartialResponseError ||
                                    err instanceof ApiRequestError ||
                                    err instanceof ApiResponseError) &&
                                  err instanceof Error),
                                RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('twitter fetch tweet like failed', err)))
                              )
                            )
                          ),
                          RxJS.finalize(() => this._logger.debug(`pipe(2-0): finalize twitter client userTimeline . . .`)),
                          this.retryWithDelay(30000, 3),
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
          // fetch likes and retweets of contents
          RxJS.concatMap((data) =>
            RxJS.concat(
              // fetch tweetLikedBy of each stream content
              RxJS.defer(() =>
                RxJS.from(this._twitterClient.tweetLikedBy(data.socialEvent.contentId, {
                  asPaginator: true,
                  "user.fields": ["id", "name", "username"]
                }))
              )
              .pipe(
                RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
                RxJS.tap({
                  next: (paginator) => this._logger.debug(`pipe(3-0): tweeter client paginator tweets Likes count: ${paginator.meta.result_count}`),
                  error: (error) => this._logger.error(`pipe(3-0): paginator failed, tweet.Id: ${data.socialEvent.contentId}`, error)
                }),
                RxJS.concatMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                      RxJS.tap({
                        next: (paginator) => this._logger.debug(`pipe(3-0): paginator rate limit not exceeded, tweet.Id: ${data.socialEvent.contentId}, remaining: ${paginator.rateLimit.remaining}`),
                      })
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                      RxJS.tap({
                        next: (paginator) => this._logger.warn(`pipe(3-0): paginator rate limit exceeded, tweet.Id: ${data.socialEvent.contentId}, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                      }),
                      RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
                    )
                  )
                ),
                RxJS.mergeMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.tap((paginator) => this._logger.log(`pipe(3-1): tweet Liked found, tweet.Id: ${data.socialEvent.contentId}, count: ${paginator.meta.result_count}`)),
                      RxJS.concatMap((paginator) =>
                        RxJS.from(paginator.data.data).pipe(
                          RxJS.concatMap((tweetLiked:UserV2) =>
                            RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                                .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                                .addSelect('"sub"."tid" as "trackerId"')
                                .addSelect('"sub"."eid" as "eventId"')
                                .addSelect('"users"."email"')
                                .innerJoin("user", "users", '"users"."id" = "socialProfile"."userId"')
                                .leftJoin(qb =>
                                  qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                                    .from(SocialProfileEntity, "profile")
                                    .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                                    .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                                    .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "event"."airdropScheduleId"')
                                    .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
                                    .where('"event"."contentId" = :contentId', {contentId: data.socialEvent.contentId})
                                    .andWhere('"tracker"."actionType" = \'LIKE\'')
                                    .andWhere('"profile"."username" = :username', {username: tweetLiked.username})
                                    .andWhere('"profile"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType})
                                    .andWhere('"socialLively"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType}),
                                  "sub", '"sub"."pid" = "socialProfile"."id"')
                                .where('"socialProfile"."username" = :username', {username: tweetLiked.username})
                                .andWhere('"socialProfile"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType})
                                .getRawOne()
                            ).pipe(
                              RxJS.tap( {
                                error: (error) => this._logger.error(`pipe(3-1): find socialProfile and socialTracker failed, tweet.Id: ${data.socialEvent.contentId}`, error),
                              }),
                              RxJS.mergeMap((queryResult) =>
                                RxJS.merge(
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!!queryResult ),
                                    RxJS.tap( {
                                      next: (_) => this._logger.debug(`pipe(3-1): socialProfile and socialTracker not found, tweet.Id: ${data.socialEvent.contentId}, username: ${tweetLiked.username}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!queryResult && queryResult.trackerId && queryResult.eventId),
                                    RxJS.tap( {
                                      next: (queryResult) => this._logger.debug(`pipe(3-1): socialTracker already exists, tweet.Id: ${data.socialEvent.contentId}, socialTracker.id: ${queryResult.trackerId}, socialProfile.username: ${queryResult.profileUsername}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!queryResult && !queryResult.eventId && queryResult.profileId),
                                    RxJS.tap( {
                                      next: (queryResult) => this._logger.debug(`pipe(3-1): socialProfile found, tweet.Id: ${data.socialEvent.contentId}, socialProfile.username: ${queryResult.profileUsername}`),
                                    }),
                                  )
                                )
                              ),
                              RxJS.map((queryResult) => {
                                const socialProfile = new SocialProfileEntity();
                                socialProfile.id = queryResult.profileId;
                                socialProfile.username = queryResult.profileUsername;

                                const socialTracker = new SocialTrackerEntity();
                                socialTracker.actionType = SocialActionType.LIKE;
                                socialTracker.socialEvent = data.socialEvent;
                                socialTracker.socialProfile = socialProfile;

                                const socialLikeAirdrop = new SocialAirdropEntity();
                                socialLikeAirdrop.airdropRule = data.airdropLikeRule;
                                socialLikeAirdrop.socialTracker = socialTracker;

                                return { socialTracker, socialLikeAirdrop, ...data};
                              }),
                              RxJS.concatMap((pipeResult) =>
                                RxJS.from(
                                  this._entityManager.connection.transaction(async (manager) => {
                                    await manager.createQueryBuilder()
                                      .insert()
                                      .into(SocialTrackerEntity)
                                      .values([pipeResult.socialTracker])
                                      .execute()

                                    await manager.createQueryBuilder()
                                      .insert()
                                      .into(SocialAirdropEntity)
                                      .values([pipeResult.socialLikeAirdrop])
                                      .execute();
                                  })
                                ).pipe(RxJS.tap({
                                    next: (_) => this._logger.log(`pipe(3-1): save socialTracker success, tweet.Id: ${data.socialEvent.contentId}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`),
                                    error: (error) => this._logger.error(`pipe(3-1): save socialTracker failed, tweet.Id: ${data.socialEvent.contentId}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`, error),
                                  }),
                                )
                              ),
                              RxJS.tap({
                                error: err => this._logger.error(`pipe(3-1): fetch and persist tweet Likes failed`, err)
                              }),
                              RxJS.catchError(error => RxJS.throwError(() => new TrackerError('fetch and persist tweet Likes failed', error)))
                            )
                          )
                        )
                      ),
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.data.meta.result_count),
                      RxJS.tap((_) => this._logger.log(`pipe(3-2): tweet Liked not found, tweet.Id: ${data.socialEvent.contentId}`)),
                      RxJS.mergeMap(_ => RxJS.EMPTY)
                    )
                  )
                ),
                RxJS.retry({
                  delay: (error) =>
                    RxJS.merge(
                      RxJS.of(error).pipe(
                        RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                        RxJS.tap({
                          next: (paginator) => this._logger.warn(`pipe(3-0): tweeter client (tweet like) rate limit exceeded, retry for 15 minutes later`),
                        }),
                        RxJS.delay(960000)
                      ),
                      RxJS.of(error).pipe(
                        RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                        RxJS.mergeMap(err => RxJS.throwError(err))
                      ),
                    )
                }),
                RxJS.tap({
                  error: err => this._logger.error(`pipe(3-0): twitter client tweetLikedBy failed`, err)
                }),
                RxJS.catchError((error) =>
                  RxJS.merge(
                    RxJS.of(error).pipe(
                      RxJS.filter(err =>
                        err instanceof ApiPartialResponseError ||
                        err instanceof ApiRequestError ||
                        err instanceof ApiResponseError
                      ),
                      RxJS.mergeMap(err => RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err)))
                    ),
                    RxJS.of(error).pipe(
                      RxJS.filter(err => err instanceof TrackerError),
                      RxJS.mergeMap(err => RxJS.throwError(err))
                    ),
                    RxJS.of(error).pipe(
                      RxJS.filter(err =>
                        !(err instanceof TrackerError ||
                          err instanceof ApiPartialResponseError ||
                          err instanceof ApiRequestError ||
                          err instanceof ApiResponseError) &&
                        err instanceof Error),
                      RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('twitter fetch tweet like failed', err)))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`pipe(3-0): finalize twitter client tweetLikedBy, tweet.id: ${data.socialEvent.contentId}`)),
                this.retryWithDelay(30000, 3),
              ),
              // fetch tweetRetweetedBy of each stream content
              RxJS.defer(() =>
                RxJS.from(this._twitterClient.tweetRetweetedBy(data.socialEvent.contentId, {
                  asPaginator: true,
                  "user.fields": ["id", "name", "username"]
                }))
              ).pipe(
                RxJS.expand((paginator: TweetRetweetersUsersV2Paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
                RxJS.tap({
                  next: (paginator) => this._logger.debug(`pipe(4-0): tweeter client paginator tweets retweets count: ${paginator.meta.result_count}`),
                  error: (error) => this._logger.error(`pipe(4-0): paginator failed, tweet.Id: ${data.socialEvent.contentId}`, error)
                }),
                RxJS.concatMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                      RxJS.tap({
                        next: (paginator) => this._logger.debug(`pipe(4-0): paginator rate limit not exceeded, tweet.Id: ${data.socialEvent.contentId}, remaining: ${paginator.rateLimit.remaining}`),
                      })
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                      RxJS.tap({
                        next: (paginator) => this._logger.warn(`pipe(4-0): paginator rate limit exceeded, tweet.Id: ${data.socialEvent.contentId}, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                      }),
                      RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
                    )
                  )
                ),
                RxJS.mergeMap((paginator) =>
                  RxJS.merge(
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.tap((paginator) => this._logger.log(`pipe(4-1): tweet retweet found, tweet.Id: ${data.socialEvent.contentId}, count: ${paginator.meta.result_count}`)),
                      RxJS.filter((paginator) => paginator.data.meta.result_count > 0),
                      RxJS.concatMap((paginator) =>
                        RxJS.from(paginator.data.data).pipe(
                          RxJS.concatMap((tweetRetweet:UserV2) =>
                            RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
                              .select('"socialProfile"."id" as "profileId", "socialProfile"."username" as "profileUsername"')
                              .addSelect('"sub"."tid" as "trackerId"')
                              .addSelect('"sub"."eid" as "eventId"')
                              .addSelect('"users"."email"')
                              .innerJoin("user", "users", '"users"."id" = "socialProfile"."userId"')
                              .leftJoin(qb =>
                                  qb.select('"profile"."id" as "pid", "tracker"."id" as "tid", "event"."id" as "eid"')
                                    .from(SocialProfileEntity, "profile")
                                    .leftJoin("social_tracker", "tracker", '"profile"."id" = "tracker"."socialProfileId"')
                                    .innerJoin("social_event", "event", '"tracker"."socialEventId" = "event"."id"')
                                    .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "event"."airdropScheduleId"')
                                    .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
                                    .where('"event"."contentId" = :contentId', {contentId: data.socialEvent.contentId})
                                    .andWhere('"tracker"."actionType" = \'RETWEET\'')
                                    .andWhere('"profile"."username" = :username', {username: tweetRetweet.username})
                                    .andWhere('"profile"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType})
                                    .andWhere('"socialLively"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType}),
                                "sub", '"sub"."pid" = "socialProfile"."id"')
                              .where('"socialProfile"."username" = :username', {username: tweetRetweet.username})
                              .andWhere('"socialProfile"."socialType" = :socialType', {socialType: data.airdropSchedule.socialLively.socialType})
                              .getRawOne()
                            ).pipe(
                              RxJS.tap( {
                                error: (error) => this._logger.error(`pipe(4-1): find socialProfile and socialTracker failed, tweet.Id: ${data.socialEvent.contentId}`, error),
                              }),
                              RxJS.mergeMap((queryResult) =>
                                RxJS.merge(
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !queryResult ),
                                    RxJS.tap( {
                                      next: (_) => this._logger.log(`pipe(4-1): socialProfile and socialTracker not found, tweet.Id: ${data.socialEvent.contentId}, username: ${tweetRetweet.username}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!queryResult && queryResult.trackerId && queryResult.eventId),
                                    RxJS.tap( {
                                      next: (queryResult) => this._logger.log(`pipe(4-1): socialTracker already exists, tweet.Id: ${data.socialEvent.contentId}, socialTracker.id: ${queryResult.trackerId}, socialProfile.username: ${queryResult.profileUsername}`),
                                    }),
                                    RxJS.mergeMap((_) => RxJS.EMPTY)
                                  ),
                                  RxJS.of(queryResult).pipe(
                                    RxJS.filter((queryResult) => !!queryResult && !queryResult.eventId && queryResult.profileId),
                                    RxJS.tap( {
                                      next: (queryResult) => this._logger.log(`pipe(4-1): socialProfile found, tweet.Id: ${data.socialEvent.contentId}, socialProfile.username: ${queryResult.profileUsername}`),
                                    }),
                                  )
                                )
                              ),
                              RxJS.map((queryResult) => {
                                const socialProfile = new SocialProfileEntity();
                                socialProfile.id = queryResult.profileId;
                                socialProfile.username = queryResult.profileUsername;
                                const socialTracker = new SocialTrackerEntity();
                                socialTracker.actionType = SocialActionType.RETWEET;
                                socialTracker.socialEvent = data.socialEvent;
                                socialTracker.socialProfile = socialProfile;

                                const socialRetweetAirdrop = new SocialAirdropEntity();
                                socialRetweetAirdrop.airdropRule = data.airdropRetweetRule;
                                socialRetweetAirdrop.socialTracker = socialTracker;

                                return { socialTracker, socialRetweetAirdrop, ...data};
                              }),
                              RxJS.concatMap((pipeResult) =>
                                RxJS.from(
                                  this._entityManager.connection.transaction(async (manager) => {
                                    await manager.createQueryBuilder()
                                      .insert()
                                      .into(SocialTrackerEntity)
                                      .values([pipeResult.socialTracker])
                                      .execute()

                                    await manager.createQueryBuilder()
                                      .insert()
                                      .into(SocialAirdropEntity)
                                      .values([pipeResult.socialRetweetAirdrop])
                                      .execute();
                                  })
                                ).pipe(
                                  RxJS.tap({
                                    next: (_) => this._logger.log(`pipe(4-1): save socialTracker success, tweet.Id: ${data.socialEvent.contentId}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`),
                                    error: (error) => this._logger.error(`pipe(4-1): save socialTracker failed, tweet.Id: ${data.socialEvent.contentId}, action: ${pipeResult.socialTracker.actionType}, user: ${pipeResult.socialTracker.socialProfile.username}`, error),
                                  }),
                                )
                              ),
                              RxJS.tap({
                                error: (error) => this._logger.error(`pipe(4-1): fetch and persist tweet retweets failed`, error),
                              }),
                              RxJS.catchError(error => RxJS.throwError(() => new TrackerError('fetch and persist tweet retweets failed', error)))
                            )
                          )
                        )
                      ),
                    ),
                    RxJS.of(paginator).pipe(
                      RxJS.filter((paginator) => !paginator.data.meta.result_count),
                      RxJS.tap((_) => this._logger.log(`pipe(4-2): tweet retweet not found, tweet.Id: ${data.socialEvent.contentId}`)),
                      RxJS.mergeMap(_ => RxJS.EMPTY)
                    )
                  )
                ),
                RxJS.retry({
                  delay: (error) =>
                    RxJS.merge(
                      RxJS.of(error).pipe(
                        RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                        RxJS.tap({
                          next: (paginator) => this._logger.warn(`pipe(3-0): tweeter client (tweet Retweet) rate limit exceeded, retry for 15 minutes later`),
                        }),
                        RxJS.delay(960000)
                      ),
                      RxJS.of(error).pipe(
                        RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                        RxJS.mergeMap(err => RxJS.throwError(err))
                      ),
                    )
                }),
                RxJS.tap({
                  error: err => this._logger.error(`pipe(4-0): twitter client tweetRetweetedBy failed`, err)
                }),
                RxJS.catchError((error) =>
                  RxJS.merge(
                    RxJS.of(error).pipe(
                      RxJS.filter(err =>
                        err instanceof ApiPartialResponseError ||
                        err instanceof ApiRequestError ||
                        err instanceof ApiResponseError
                      ),
                      RxJS.mergeMap(err => RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err)))
                    ),
                    RxJS.of(error).pipe(
                      RxJS.filter(err => err instanceof TrackerError),
                      RxJS.mergeMap(err => RxJS.throwError(err))
                    ),
                    RxJS.of(error).pipe(
                      RxJS.filter(err =>
                        !(err instanceof TrackerError ||
                          err instanceof ApiPartialResponseError ||
                          err instanceof ApiRequestError ||
                          err instanceof ApiResponseError) &&
                        err instanceof Error),
                      RxJS.mergeMap(err => RxJS.throwError(() => new TrackerError('twitter fetch tweet retweet failed', err)))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`pipe(4-0): finalize twitter client tweetRetweetedBy, tweet.id: ${data.socialEvent.contentId}`)),
                this.retryWithDelay(30000, 3),
              )
            )
          )
        )
      ),
    ).subscribe({
      error: (err) => {
        this._logger.error(`fetchTweetsFromPage failed,\n cause: ${err?.cause?.stack}`, err);
        this._isRunning = false;
      },
      complete: () => {
        this._logger.debug(`fetchTweetsFromPage completed`);
        this._isRunning = false;
      },
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
              this._logger.warn(`fetch tweets failed, retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}