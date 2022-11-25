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
import { finalize } from "rxjs";
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialActionType } from "../../entity/enums";
import { SocialAirdropRuleEntity } from "../../entity/socialAirdropRule.entity";
import { SocialAirdropEntity } from "../../entity/socialAirdrop.entity";
import { TwitterFollowerError } from "../../error/twitterFollower.error";
import { SocialEventEntity } from "../../entity/socialEvent.entity";
import { SocialFollowerEntity } from "../../entity/socialFollower.entity";

@Injectable()
export class TwitterFollowerJob {
  private readonly _logger = new Logger(TwitterFollowerJob.name);
  private readonly _authToken: string;
  private readonly _twitterClient: TwitterApiv2ReadOnly;
  // private readonly _startAt: Date;
  // private readonly _endAt: Date;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    private readonly _configService: ConfigService)
  {
    this._authToken = this._configService.get<string>('airdrop.twitter.authToken');
    if (!this._authToken) {
      throw new Error("airdrop.twitter.authToken config is empty");
    }

    // const startTimestamp = this._configService.get<number>('airdrop.twitter.startAt');
    // const endTimestamp = this._configService.get<number>('airdrop.twitter.endAt');
    // this._startAt = new Date(startTimestamp);
    // this._endAt = new Date(endTimestamp);

    this._twitterClient = new TwitterApi(this._authToken).v2.readOnly;
    this.fetchTwitterFollowers();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  fetchTwitterFollowers() {

    // if (this._startAt.getTime() > Date.now()) {
    //   this._logger.debug(`fetchTwitterFollowers this._startAt ${this._startAt.getTime()} greater than now ${Date.now()}`);
    //   return
    // }
    //
    // if (this._endAt.getTime() < Date.now()) {
    //   this._logger.debug(`fetchTwitterFollowers this._endAt ${this._endAt.getTime()} less than now ${Date.now()}`);
    //   return
    // }

    const socialLivelyQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.debug(`fetch social lively success, socialType: ${socialLively.socialType}`)),
        RxJS.catchError(err => RxJS.throwError(() => new TwitterFollowerError('fetch social lively failed', err)))
      )

    const socialEventQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(SocialEventEntity, "socialEvent")
      .select()
      .leftJoin("social_lively", "socialLively", '"socialLively"."id" = "socialEvent"."socialLivelyId"')
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialEvent"."isActive" = \'true\'')
      .andWhere('("socialEvent"."content"->\'data\'->>\'hashTags\')::jsonb ? \'follow\'')
      .andWhere('"socialEvent"."trackingEndAt" > NOW()')
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
        RxJS.catchError(err => RxJS.throwError(() => new TwitterFollowerError('fetch social event airdrop follow failed', err)))
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
          RxJS.catchError(err => RxJS.throwError(() => new TwitterFollowerError('fetch tweeter follower airdrop rule failed', err)))
        )
      ),
      RxJS.concatMap(([socialLively, socialEvent, airdropRule ]: [SocialLivelyEntity, SocialEventEntity, SocialAirdropRuleEntity]) =>
        RxJS.from(this._twitterClient.followers(socialLively.userId, {
            max_results: 128,
            asPaginator: true,
            "user.fields": ["id", "name", "username", "url", "location", "entities"]})).pipe(
          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
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
            error: (error) => this._logger.error(`tweeter client paginator users failed`, error)
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
                  RxJS.delay(960000)
                ),
                RxJS.of(error).pipe(
                  RxJS.filter(err => (err instanceof ApiResponseError && err.code !== 429) || !(err instanceof ApiResponseError)),
                  RxJS.mergeMap(err => RxJS.throwError(err))
                ),
              )
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
                RxJS.mergeMap(err => RxJS.throwError(() => new TwitterFollowerError('twitter fetch follower failed', err)))
              )
            )
          ),
          finalize(() => this._logger.debug(`finalize twitter client follower . . .`)),
          this.retryWithDelay(30000, 3),
        )
      ),
      RxJS.concatMap(([socialLively, socialEvent, airdropRule, twitterUser]: [SocialLivelyEntity, SocialEventEntity, SocialAirdropRuleEntity, UserV2]) =>
        RxJS.from(this._entityManager.createQueryBuilder(SocialProfileEntity, "socialProfile")
          .select('"socialProfile".*')
          .addSelect('"socialFollower"."id" as "followerId"')
          .leftJoin("social_follower", "socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
          .where('"socialProfile"."username" = :username', {username: twitterUser.username})
          .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
          .getRawOne()
        ).pipe(
          RxJS.concatMap((socialProfileExt) =>
            RxJS.merge(
              RxJS.of(socialProfileExt).pipe(
                RxJS.filter((data) => !!data),
                RxJS.map((data) => {
                  let {followerId, ...socialProfile } = data;
                  return {followerId, socialProfile, socialLively, socialEvent, airdropRule, twitterUser};
                })
              ),
              RxJS.of(socialProfileExt).pipe(
                RxJS.filter((data) => !data),
                RxJS.map((_) => {
                  return {
                    followerId: null,
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
          RxJS.catchError(error => RxJS.throwError(() => new TwitterFollowerError('fetch lively socialProfile failed', error)))
        ),
      ),
      RxJS.concatMap((inputData) =>
        RxJS.merge(
          RxJS.of(inputData).pipe(
            RxJS.filter((data)=> !data.followerId && !!data.socialProfile),
            RxJS.map((data) => {
              data.socialProfile.socialId = data.twitterUser.id;
              data.socialProfile.socialName = data.twitterUser.name;
              data.socialProfile.profileUrl = "https://twitter.com/" + data.socialProfile.username;
              data.socialProfile.location = data.twitterUser.location;
              data.socialProfile.website = data.twitterUser.entities?.url?.urls[0]?.expanded_url;

              const socialFollower = new SocialFollowerEntity();
              socialFollower.socialProfile = data.socialProfile;
              socialFollower.socialLively = data.socialLively;

              if(data.socialEvent) {
                const socialTracker = new SocialTrackerEntity();
                socialTracker.actionType = SocialActionType.FOLLOW;
                socialTracker.socialProfile = data.socialProfile;
                socialTracker.socialEvent = data.socialEvent;
                socialTracker.follower = socialFollower;

                socialFollower.socialTracker = socialTracker;

                const socialAirdrop = new SocialAirdropEntity();
                socialAirdrop.airdropRule = data.airdropRule;
                socialAirdrop.socialTracker = socialTracker;
                return ({socialFollower, socialTracker, socialAirdrop, ...data})
              } else {
                return ({socialFollower, socialTracker: null, socialAirdrop: null, ...data})
              }
            }),
            RxJS.concatMap((data) =>
              RxJS.from(
                this._entityManager.connection.transaction(async (manager) => {
                  await manager.createQueryBuilder()
                    .insert()
                    .into(SocialFollowerEntity)
                    .values([data.socialFollower])
                    .execute();

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
                    socialFollower: data.socialFollower,
                  };
                }),
                RxJS.tap({
                  error: err => this._logger.error(`twitter follower transaction failed, socialUsername: ${data.socialProfile.username}, socialProfileId: ${data.socialProfile.Id}`,err)
                }),
                RxJS.catchError(error => RxJS.throwError(() => new TwitterFollowerError('twitter follower transaction failed', error)))
              )
            ),
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((data) => !data.socialProfile),
            RxJS.map((data) => { data.socialProfile }),
            RxJS.tap((_) => this._logger.debug(`twitter follower hasn't still registered, username: ${inputData.twitterUser.username}`))
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((data)=> data.followerId && data.socialProfile),
            RxJS.map((data) => { data.socialProfile }),
            RxJS.tap((mapData) => this._logger.debug(`twitter follower already has registered, username: ${inputData.twitterUser.username}`))
          )
        )
      ),
    ).subscribe({
      next: (data: {socialFollower: SocialFollowerEntity, socialProfile: SocialProfileEntity, socialTracker: SocialTrackerEntity, socialAirdrop: SocialAirdropEntity}) => {
        if (data?.socialFollower) {
          this._logger.log(`new follower persist successfully, follower: ${data.socialProfile.username}`);
        } else if (data?.socialProfile) {
          this._logger.log(`social profile has updated successfully, username: ${data.socialProfile.username}`);
        }
      },
      error: (error) => this._logger.error(`fetch tweeter followers failed\n cause: ${error?.cause?.stack}`, error),
      complete: () => this._logger.debug(`fetch tweeter followers completed`)
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

