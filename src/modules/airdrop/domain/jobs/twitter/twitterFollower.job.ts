import { Injectable, Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { InjectEntityManager } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TwitterApi } from "twitter-api-v2";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import * as RxJS from "rxjs";
import { SocialProfileEntity, SocialType } from "../../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { UserV2 } from "twitter-api-v2/dist/types/v2/user.v2.types";
import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { TwitterApiError } from "../../error/twitterApi.error";
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialActionType } from "../../entity/enums";
import { SocialAirdropRuleEntity } from "../../entity/socialAirdropRule.entity";
import { SocialAirdropEntity } from "../../entity/socialAirdrop.entity";
import { FollowerError } from "../../error/follower.error";
import { SocialEventEntity } from "../../entity/socialEvent.entity";

@Injectable()
export class TwitterFollowerJob {
  private readonly _logger = new Logger(TwitterFollowerJob.name);
  private readonly _authToken: string;
  private readonly _twitterClient: TwitterApiv2ReadOnly;
  private _isRunning: boolean;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    private readonly _configService: ConfigService)
  {
    this._authToken = this._configService.get<string>('airdrop.twitter.authToken');
    if (!this._authToken) {
      throw new Error("airdrop.twitter.authToken config is empty");
    }

    this._isRunning = false;
    this._twitterClient = new TwitterApi(this._authToken).v2.readOnly;
    this.fetchTwitterFollowers();
  }

  @Cron(CronExpression.EVERY_HOUR)
  fetchTwitterFollowers() {

    if(!this._isRunning) {
      this._isRunning = true;
    } else {
      this._logger.warn("fetchTwitterFollowers is already running . . .");
      return;
    }

    const socialLivelyQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.debug(`fetch social lively success, socialType: ${socialLively.socialType}`)),
        RxJS.catchError(err => RxJS.throwError(() => new FollowerError('fetch TWITTER social lively failed', err)))
      )

    const socialEventQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialEventEntity, "socialEvent")
      .select()
      .innerJoin("social_airdrop_schedule", "airdropSchedule", '"airdropSchedule"."id" = "socialEvent"."airdropScheduleId"')
      .innerJoin("social_lively", "socialLively", '"socialLively"."id" = "airdropSchedule"."socialLivelyId"')
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialEvent"."isActive" = \'true\'')
      .andWhere('("socialEvent"."content"->\'data\'->>\'hashtags\')::jsonb ? ("airdropSchedule"."hashtags"->>\'join\')::text')
      .andWhere('"airdropSchedule"."airdropEndAt" > NOW()')
      .getOne())
      .pipe(
        RxJS.mergeMap((queryResult) =>
          RxJS.merge(
            RxJS.of(queryResult).pipe(
              RxJS.filter((socialEvent) => !!socialEvent),
              RxJS.tap((socialEvent) => this._logger.debug(`fetch social event airdrop follow found, socialEventId: ${socialEvent?.id}, contentUrl: ${socialEvent?.contentUrl}`)),
            ),
            RxJS.of(queryResult).pipe(
              RxJS.filter((socialEvent) => !socialEvent),
              RxJS.tap((_) => this._logger.debug(`fetch social event airdrop follow not found`)),
            )
          )
        ),
        RxJS.catchError(err => RxJS.throwError(() => new FollowerError('fetch social event airdrop follow failed', err)))
      )

    this._logger.debug("tweets follower job starting . . . ");

    RxJS.zip(socialLivelyQueryResultObservable, socialEventQueryResultObservable).pipe(
      // fetch social twitter airdrop rules
      RxJS.mergeMap(([socialLively, socialEvent]) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
          .select()
          .where('"airdropRule"."socialType" = :socialType', {socialType: SocialType.TWITTER})
          .andWhere('"airdropRule"."actionType" = :actionType', {actionType: SocialActionType.FOLLOW})
          .getOneOrFail()
        ).pipe(
          RxJS.tap({
            next: (airdropRule) => this._logger.debug(`tweeter follower airdrop rule found, token: ${airdropRule.unit},  amount: ${airdropRule.amount}, decimal: ${airdropRule.decimal}`),
            error: (err) => this._logger.error(`find tweeter follower airdrop rule failed`,err)
          }),
          RxJS.map((airdropRule) => [ socialLively, socialEvent, airdropRule ]),
          RxJS.catchError(err => RxJS.throwError(() => new FollowerError('fetch tweeter follower airdrop rule failed', err)))
        )
      ),
      RxJS.concatMap(([socialLively, socialEvent, airdropRule ]: [SocialLivelyEntity, SocialEventEntity, SocialAirdropRuleEntity]) =>
        RxJS.defer(() =>
          RxJS.from(this._twitterClient.followers(socialLively.userId, {
            max_results: 256,
            asPaginator: true,
            "user.fields": ["id", "name", "username", "url", "location", "entities"]
          }))
        ).pipe(
          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY, 1),
          RxJS.concatMap((paginator) =>
            RxJS.merge(
              RxJS.of(paginator).pipe(
                RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                RxJS.tap({
                  next: (paginator) => this._logger.debug(`tweeter client paginator rate limit not exceeded, remaining: ${paginator.rateLimit.remaining}`),
                })
              ),
              RxJS.of(paginator).pipe(
                RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                RxJS.tap({
                  next: (paginator) => this._logger.warn(`tweeter client paginator rate limit exceeded, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                }),
                RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
              )
            )
          ),
          RxJS.tap({
            next: (paginator) => this._logger.log(`tweeter client paginator users count: ${paginator.meta.result_count}`),
          }),
          RxJS.concatMap((paginator) =>
            RxJS.from(paginator.users).pipe(
              RxJS.map((follower) => [socialLively, socialEvent, airdropRule, follower]),
            )
          ),
          RxJS.retry({
            delay: (error) =>
              RxJS.merge(
                RxJS.of(error).pipe(
                  RxJS.filter(err => err instanceof ApiResponseError && err.code === 429),
                  RxJS.tap({
                    next: (paginator) => this._logger.warn(`tweeter client rate limit exceeded, retry for 15 minutes later`),
                  }),
                  // 15 minutes wait for api call limitation
                  RxJS.delay(960000)
                ),
                RxJS.of(error).pipe(
                  RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                  RxJS.mergeMap(err => RxJS.throwError(err))
                ),
              )
          }),
          RxJS.tap({
            error: (error) => this._logger.error(`tweeter client fetch followers failed`, error)
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
                RxJS.filter(err => err instanceof Error),
                RxJS.mergeMap(err => RxJS.throwError(() => new FollowerError('twitter fetch follower failed', err)))
              )
            )
          ),
          RxJS.finalize(() => this._logger.debug(`finalize twitter client follower . . .`)),
          this.retryWithDelay(30000, 3),
        )
      ),
      RxJS.concatMap(([socialLively, socialEvent, airdropRule, twitterUser]: [SocialLivelyEntity, SocialEventEntity, SocialAirdropRuleEntity, UserV2]) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
          .select('"socialProfile".*')
          .addSelect('"socialTracker"."id" as "trackerId"')
          .leftJoin("user", "users", '"users"."id" = "socialProfile"."userId"')
          .leftJoin("social_tracker", "socialTracker",
            '"socialTracker"."socialProfileId" = "socialProfile"."id" and "socialTracker"."actionType" = :type', {type: SocialActionType.FOLLOW})
          .where('"socialProfile"."username" = :username', {username: twitterUser.username})
          .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
          .getRawOne()
        ).pipe(
          RxJS.concatMap((result) =>
            RxJS.merge(
              RxJS.of(result).pipe(
                RxJS.filter((data) => !!data),
                RxJS.map((data) => {
                    const {trackerId, ...socialProfile} = data;
                    return {
                      trackerId,
                      socialProfile,
                      socialLively,
                      socialEvent,
                      airdropRule,
                      twitterUser
                    };
                })
              ),
              RxJS.of(result).pipe(
                RxJS.filter((data) => !data),
                RxJS.map((_) => {
                  return {
                    trackerId: null,
                    socialProfile: null,
                    socialLively,
                    socialEvent,
                    airdropRule,
                    twitterUser
                  }
                })
              ),
            )
          ),
          RxJS.tap({
            error: err => this._logger.error(`fetch lively socialProfile failed`, err)
          }),
          RxJS.catchError(error => RxJS.throwError(() => new FollowerError('fetch lively socialProfile failed', error)))
        ),
      ),
      RxJS.concatMap((inputData) =>
        RxJS.merge(
          RxJS.of(inputData).pipe(
            RxJS.filter((data)=> !data.socialProfile),
            RxJS.map((data) => {
               data.socialProfile = new SocialProfileEntity();
                data.socialProfile.username = data.twitterUser.username;
                data.socialProfile.socialType = SocialType.TWITTER;
                data.socialProfile.socialId = data.twitterUser.id;
                data.socialProfile.socialName = data.twitterUser.name;
                data.socialProfile.profileUrl = "https://twitter.com/" + data.socialProfile.username;
                data.socialProfile.location = data.twitterUser.location;
                data.socialProfile.website = data.twitterUser.entities?.url?.urls[0]?.expanded_url;
              return ({socialProfile: data.socialProfile, socialTracker: null, socialAirdrop: null, ...data})
            }),
            RxJS.concatMap((data) =>
              RxJS.from(this._entityManager.getRepository(SocialProfileEntity).insert(data.socialProfile)
              ).pipe(
                RxJS.map((result) => {
                  return {
                    socialProfile: data.socialProfile,
                    socialTracker: data.socialTracker,
                    socialAirdrop: data.socialAirdrop,
                  };
                }),
                RxJS.tap({
                  next: data => this._logger.debug(`register twitter follower profile success, username: ${data.socialProfile.username}`),
                  error: err => this._logger.error(`twitter follower transaction failed, socialUsername: ${data.socialProfile.username}, socialProfileId: ${data.socialProfile.Id}`,err)
                }),
                RxJS.catchError(error => RxJS.throwError(() => new FollowerError('twitter follower transaction failed', error)))
              )
            ),
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((data)=> !data.trackerId && data.socialProfile?.userId),
            RxJS.map((data) => {
              data.socialProfile.socialId = data.twitterUser.id;
              data.socialProfile.socialName = data.twitterUser.name;
              data.socialProfile.profileUrl = "https://twitter.com/" + data.socialProfile.username;
              data.socialProfile.location = data.twitterUser.location;
              data.socialProfile.website = data.twitterUser.entities?.url?.urls[0]?.expanded_url;

              if(data.socialEvent) {
                const socialTracker = new SocialTrackerEntity();
                socialTracker.actionType = SocialActionType.FOLLOW;
                socialTracker.socialProfile = data.socialProfile;
                socialTracker.socialEvent = data.socialEvent;

                const socialAirdrop = new SocialAirdropEntity();
                socialAirdrop.airdropRule = data.airdropRule;
                socialAirdrop.socialTracker = socialTracker;
                return ({socialProfile: data.socialProfile, socialTracker, socialAirdrop, ...data})
              }
              return ({socialProfile: data.socialProfile, socialTracker: null, socialAirdrop: null, ...data})
            }),
            RxJS.concatMap((data) =>
              RxJS.from(
                this._entityManager.connection.transaction(async (manager) => {
                  if(data.socialTracker) {
                    await manager.createQueryBuilder()
                      .insert()
                      .into(SocialTrackerEntity)
                      .values([data.socialTracker])
                      .execute();

                    await manager.createQueryBuilder()
                      .insert()
                      .into(SocialAirdropEntity)
                      .values([data.socialAirdrop])
                      .execute();
                  }

                  await manager.getRepository(SocialProfileEntity).save(data.socialProfile)
                })
              ).pipe(
                RxJS.map((result) => {
                  return {
                    socialProfile: data.socialProfile,
                    socialTracker: data.socialTracker,
                    socialAirdrop: data.socialAirdrop,
                  };
                }),
                RxJS.tap({
                  next: data => this._logger.debug(`update twitter follower profile success, username: ${data.socialProfile.username}`),
                  error: err => this._logger.error(`twitter follower transaction failed, socialUsername: ${data.socialProfile.username}, socialProfileId: ${data.socialProfile.Id}`,err)
                }),
                RxJS.catchError(error => RxJS.throwError(() => new FollowerError('twitter follower transaction failed', error)))
              )
            ),
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((data) => !data.trackerId && !data.socialProfile?.userId),
            RxJS.map((data) => { data.socialProfile }),
            RxJS.tap((_) => this._logger.debug(`twitter follower hasn't still verified by user, username: ${inputData.twitterUser.username}`))
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((data)=> data.trackerId),
            RxJS.map((data) => { data.socialProfile }),
            RxJS.tap((_) => this._logger.debug(`twitter follower already has registered, username: ${inputData.twitterUser.username}`))
          )
        )
      ),
    ).subscribe({
      next: (data: {socialProfile: SocialProfileEntity, socialTracker: SocialTrackerEntity, socialAirdrop: SocialAirdropEntity}) => {
        if (data?.socialTracker) {
          this._logger.log(`twitter follower profile verified successfully, follower: ${data.socialProfile.username}, trackerId: ${data.socialTracker.id}`);
        }
      },
      error: (error) => {
        this._logger.error(`fetch tweeter followers failed\n cause: ${error?.cause?.stack}`, error);
        this._isRunning = false;
      },
      complete: () => {
        this._logger.debug(`fetch tweeter followers completed`);
        this._isRunning = false;
      }
    });
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
              this._logger.warn(`fetch twitter follower failed,\n error: ${current?.error?.cause}`)
              this._logger.log(`fetch follower retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}

