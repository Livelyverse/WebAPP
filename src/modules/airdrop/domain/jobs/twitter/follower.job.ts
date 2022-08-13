import { Injectable, Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { SocialFollowerEntity } from "../../entity/socialFollower.entity";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TwitterApi } from "twitter-api-v2";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import * as RxJS from "rxjs";
import { SocialProfileEntity, SocialType } from "../../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { UserV2 } from "twitter-api-v2/dist/types/v2/user.v2.types";
import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { TwitterApiError } from "../../error/TwitterApiError";
import { finalize } from "rxjs";
import { SocialTrackerEntity } from "../../entity/socialTracker.entity";
import { SocialActionType } from "../../entity/enums";

@Injectable()
export class TwitterFollowerJob {
  private readonly _logger = new Logger(TwitterFollowerJob.name);
  private readonly _entityManager: EntityManager
  private readonly _configService: ConfigService;
  private readonly _authToken: string
  private readonly _twitterClient: TwitterApiv2ReadOnly

  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
    readonly configService: ConfigService)
  {
    this._configService = configService;
    this._entityManager = entityManager;

    this._authToken = this._configService.get<string>('airdrop.twitter.authToken');
    if (!this._authToken) {
      throw new Error("airdrop.twitter.authToken config is empty");
    }

    this._twitterClient = new TwitterApi(this._authToken).v2.readOnly;
    this.fetchTwitterFollowers();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  fetchTwitterFollowers() {

    let socialLivelyQueryResultObservable = RxJS.from(this.entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.log(`fetch social lively, socialType: ${socialLively.socialType}`))
      )

    RxJS.from(socialLivelyQueryResultObservable).pipe(
      RxJS.switchMap((socialLively) =>
        RxJS.defer(() =>
          RxJS.from(this._twitterClient.followers(socialLively.userId, {
            max_results: 128,
            asPaginator: true,
            "user.fields": ["id", "name", "username", "url", "location", "entities"]}))
        ).pipe(
          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
          RxJS.tap({
            error: (error) => this._logger.error(`tweeter client paginator failed, ${error}`)
          }),
          RxJS.concatMap((paginator) =>
            RxJS.merge(
              RxJS.of(paginator).pipe(
                RxJS.filter((paginator) => paginator.rateLimit.remaining > 0),
                RxJS.tap({
                  next: (paginator) => this._logger.log(`tweeter client paginator rate limit not exceeded, remaining: ${paginator.rateLimit.remaining}`),
                })
              ),
              RxJS.of(paginator).pipe(
                RxJS.filter((paginator) => !paginator.rateLimit.remaining),
                RxJS.tap({
                  next: (paginator) => this._logger.log(`tweeter client paginator rate limit exceeded, resetAt: ${new Date(paginator.rateLimit.reset * 1000)}`),
                }),
                RxJS.delayWhen((paginator) => RxJS.timer(new Date(paginator.rateLimit.reset * 1000)))
              )
            )
          ),
          RxJS.tap((paginator) => this._logger.log(`tweeter client paginator users count: ${paginator.meta.result_count}`)),
          RxJS.switchMap((paginator) => {
            return RxJS.from(paginator.users)
              .pipe(RxJS.map((follower) => [socialLively, follower]))
          }),
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
              return RxJS.throwError(() => new TwitterApiError("twitter follower api failed", err))
            }
            return RxJS.throwError (err);
          }),
          finalize(() => this._logger.log(`finalize twitter client follower . . .`)),
          this.retryWithDelay(30000, 3),
        )
      ),
      RxJS.concatMap(([socialLively, twitterUser]: [SocialLivelyEntity, UserV2]) =>
        RxJS.from(this.entityManager.createQueryBuilder(SocialProfileEntity,"socialProfile")
          .select('"socialProfile".*')
          .addSelect('"socialFollower"."id" as "followerId"')
          .leftJoin("social_follower", "socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
          .where('"socialProfile"."username" = :username', {username: twitterUser.username})
          .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
          .getRawOne()
        ).pipe(
          RxJS.switchMap((socialProfileExt) => {
            return RxJS.merge(
              RxJS.of(socialProfileExt).pipe(
                RxJS.filter((data) => !!data),
                RxJS.map((data) => {
                  let { followerId: followerId, ...socialProfile } = data;
                  return {followerId, socialProfile, socialLively, twitterUser};
                })
              ),
              RxJS.of(socialProfileExt).pipe(
                RxJS.filter((data) => !!!data),
                RxJS.map((_) => {
                  return {
                    followerId: undefined,
                    socialProfile: undefined,
                    socialLively: socialLively,
                    twitterUser: twitterUser
                  }
                })
              ),
            )
          })
        ),
      ),
      RxJS.concatMap((inputData) => {
        return RxJS.merge(
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

              const socialTracker = new SocialTrackerEntity();
              socialTracker.actionType = SocialActionType.FOLLOW;
              socialTracker.socialProfile = data.socialProfile;
              return [data, socialFollower, socialTracker]
            }),
            RxJS.concatMap(([data, socialFollower, socialTracker]) => {
              return RxJS.from(
                this._entityManager.connection.transaction(async (manager) => {
                  await manager.createQueryBuilder()
                    .insert()
                    .into(SocialFollowerEntity)
                    .values([socialFollower])
                    .execute();

                  await manager.createQueryBuilder()
                    .insert()
                    .into(SocialTrackerEntity)
                    .values([socialTracker])
                    .execute();

                  await manager.getRepository(SocialProfileEntity).save(data.socialProfile)
                })
              ).pipe(
                RxJS.map((result) => {
                  return {
                    socialProfile: data.socialProfile,
                    socialTracker: socialTracker,
                    // @ts-ignore
                    followerId: socialFollower.id
                  };
                })
              )
            }),
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((value)=> !value.followerId && !(!!value.socialProfile)),
            RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
            RxJS.tap((mapData) => this._logger.log(`twitter follower hasn't still registered, username: ${inputData.twitterUser.username}`))
          ),
          RxJS.of(inputData).pipe(
            RxJS.filter((value)=> value.followerId && !!value.socialProfile),
            RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
            RxJS.tap((mapData) => this._logger.log(`twitter follower already has registered, username: ${inputData.twitterUser.username}`))
          )
        )
      }),
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
      next: (data: {socialProfile: SocialProfileEntity, socialTracker: SocialTrackerEntity, followerId: string}) => {
        if (!!data?.followerId) {
          this._logger.log(`new follower persist successfully, followerId: ${data.followerId}, trackerId: ${data.socialTracker.id}`);
        } else if (!!data?.socialProfile) {
          this._logger.log(`social profile has updated successfully, username: ${data.socialProfile.username}`);
        }
      },
      error: (error) => this._logger.error(`fetch tweeter followers failed, ${error.stack}\n${error?.cause?.stack}`),
      complete: () => this._logger.log(`fetch tweeter followers completed`)
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
              this._logger.error(`fetch twitter follower failed, error: ${current?.error?.cause}`)
              this._logger.log(`fetch follower retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}

