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
import { TypeORMError } from "typeorm/error/TypeORMError";
import { UserEntity } from "../../../../profile/domain/entity";
import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { TwitterApiError } from "../../error/TwitterApiError";
import { finalize } from "rxjs";

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
    this.fetchLivelyVerseTwitterFollowers();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  fetchLivelyVerseTwitterFollowers() {

    let socialLivelyQueryResultObservable = RxJS.from(this.entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
      .where('"socialLively"."socialType" = \'TWITTER\'')
      .andWhere('"socialLively"."isActive" = \'true\'')
      .getOneOrFail())
      .pipe(
        RxJS.tap((socialLively) => this._logger.log(`fetch social lively: ${socialLively}`))
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
          RxJS.switchMap((paginator) => {
            this._logger.log(`paginator data count: ${paginator.meta.result_count}`)
            return RxJS.from(paginator.users)
              .pipe(RxJS.map((follower) => [socialLively, follower]))
          }),
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
      RxJS.tap((inputObj) => this._logger.log(`twitter follower received, username: ${inputObj?.socialProfile?.username}`)),
      RxJS.concatMap((inputData) => {
        return RxJS.merge(
          RxJS.of(inputData).pipe(
            RxJS.filter((value)=> !value.followerId && !!value.socialProfile),
            RxJS.map((inputObj) => {
              inputObj.socialProfile.socialId = inputObj.twitterUser.id;
              inputObj.socialProfile.socialName = inputObj.twitterUser.name;
              inputObj.socialProfile.profileUrl = "https://twitter.com/" + inputObj.socialProfile.username;
              inputObj.socialProfile.location = inputObj.twitterUser.location;
              inputObj.socialProfile.website = inputObj.twitterUser.entities?.url?.urls[0]?.expanded_url;
              // this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter follower found, id: ${inputObj.socialProfile.id}, username: ${inputObj.socialProfile.username}`);
              let socialFollower = new SocialFollowerEntity();
              socialFollower.socialProfile = inputObj.socialProfile;
              socialFollower.socialLively = inputObj.socialLively;
              return [inputObj, socialFollower]
            }),
            RxJS.concatMap(([filterData, socialFollower]) => {
              return RxJS.from(
                this._entityManager.connection.transaction(async (manager) => {
                  await manager.createQueryBuilder()
                    .insert()
                    .into(SocialFollowerEntity)
                    .values([socialFollower])
                    .execute();

                  await manager.createQueryBuilder()
                    .update(SocialProfileEntity)
                    .set(filterData.socialProfile)
                    .where("id = :id", { id: filterData.socialProfile.id })
                    .execute();
                })
              ).pipe(
                RxJS.map((result) => {
                  this._logger.log(`result update: ${result}`);
                  return {
                    socialProfile: filterData.socialProfile,
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
            RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower hasn't still registered, username: ${inputData.twitterUser.username}`))
          ),
          // RxJS.of(inputData).pipe(
          //   RxJS.filter((value)=> !value.followerId && !(!!value.socialProfile)),
          //   RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower hasn't still registered, username: ${inputData.twitterUser.username}`)),
          //   RxJS.map((filterData) => {
          //     let newTwitterUser = new UserEntity();
          //     newTwitterUser.id = "77f2bdbd-49da-49ab-9c8f-70d24830de95";
          //
          //     let newSocialProfile = new SocialProfileEntity();
          //     newSocialProfile.socialType = SocialType.TWITTER;
          //     newSocialProfile.socialId = filterData.twitterUser.id;
          //     newSocialProfile.username = filterData.twitterUser.username;
          //     newSocialProfile.profileName = filterData.twitterUser.name;
          //     newSocialProfile.profileUrl = "https://twitter.com/" + newSocialProfile.username;
          //     newSocialProfile.location = filterData.twitterUser.location;
          //     newSocialProfile.website = filterData.twitterUser.entities?.url?.urls[0]?.expanded_url;
          //     newSocialProfile.user = newTwitterUser;
          //     this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter follower found, id: ${newSocialProfile.id}, username: ${newSocialProfile.username}`);
          //
          //     let socialFollower = new SocialFollowerEntity();
          //     socialFollower.socialProfile = newSocialProfile;
          //     socialFollower.socialLively = filterData.socialLively;
          //
          //     return [newSocialProfile, filterData.socialLively, filterData.twitterUser, socialFollower]
          //   }),
          //   RxJS.concatMap((tuple) => {
          //     return RxJS.from(this._entityManager.connection.transaction(async (manager) => {
          //       let result = await manager.createQueryBuilder()
          //         .insert()
          //         .into(SocialProfileEntity)
          //         .values([tuple[0]])
          //         .execute();
          //
          //       this._logger.log(`social profile insert result: ${result}`);
          //
          //       await manager.createQueryBuilder()
          //         .insert()
          //         .into(SocialFollowerEntity)
          //         .values([tuple[3]])
          //         .execute();
          //
          //       this._logger.log(`social follower insert result: ${result}`);
          //       return {
          //         socialProfile: tuple[0],
          //         // @ts-ignore
          //         followerId: tuple[3].id
          //       };
          //     }))
          //   })
          // ),
          RxJS.of(inputData).pipe(
            RxJS.filter((value)=> value.followerId && !!value.socialProfile),
            RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
            RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower already has registered, username: ${inputData.twitterUser.username}`))
          )
        )
      }),
    ).subscribe({
      next: (inputData: {socialProfile: SocialProfileEntity, followerId: string}) => {
        if (inputData && inputData.followerId) {
          this._logger.log(`new follower persist successfully, id: ${inputData.followerId}`);
        } else if (inputData && inputData.socialProfile){
          this._logger.log(`social profile has updated successfully, username: ${inputData.socialProfile.username}`);
        }},
      error: (error) => {
          this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, 
            error: ${error},
            stack: ${error?.stack}, 
            cause-stack: ${error?.cause?.stack}`)
      },
      complete: () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
    });
  }

  // @Cron(CronExpression.EVERY_10_MINUTES)
  // fetchLivelyVerseTwitterFollowers() {
  //
  //   let socialLivelyQueryResultObservable = RxJS.from(this.entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
  //     .where('"socialLively"."socialType" = \'TWITTER\'')
  //     .andWhere('"socialLively"."isActive" = \'true\'')
  //     .getOneOrFail())
  //     .pipe(
  //       RxJS.tap((socialLively) => this._logger.log(`fetch social lively: ${socialLively}`))
  //     )
  //
  //   RxJS.from(socialLivelyQueryResultObservable).pipe(
  //     RxJS.switchMap((socialLively) =>
  //       RxJS.from(this._twitterClient.followers(socialLively.userId, {
  //         max_results: 128,
  //         asPaginator: true,
  //         "user.fields": ["id", "name", "username", "url", "location", "entities"]})
  //       ).pipe(
  //         RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
  //         RxJS.switchMap((paginator) => {
  //           this._logger.log(`paginator data count: ${paginator.meta.result_count}`)
  //           return RxJS.from(paginator.users)
  //             .pipe(RxJS.map((follower) => [socialLively, follower]))
  //         }),
  //       )
  //     ),
  //     RxJS.concatMap(([socialLively, twitterUser]: [SocialLivelyEntity, UserV2]) =>
  //       RxJS.from(this.entityManager.createQueryBuilder(SocialProfileEntity,"socialProfile")
  //         .select('"socialProfile".*')
  //         .addSelect('"socialFollower"."id" as "followerId"')
  //         .leftJoin("social_follower", "socialFollower", '"socialFollower"."socialProfileId" = "socialProfile"."id"')
  //         .where('"socialProfile"."username" = :username', {username: twitterUser.username})
  //         .andWhere('"socialProfile"."socialType" = :socialType', {socialType: socialLively.socialType})
  //         .getRawOne()
  //       ).pipe(
  //         RxJS.switchMap((socialProfileExt) => {
  //           return RxJS.merge(
  //             RxJS.of(socialProfileExt).pipe(
  //               RxJS.filter((data) => !!data),
  //               RxJS.map((data) => {
  //                 let { followerId: followerId, ...socialProfile } = data;
  //                 return {followerId, socialProfile, socialLively, twitterUser};
  //               })
  //             ),
  //             RxJS.of(socialProfileExt).pipe(
  //               RxJS.filter((data) => !!!data),
  //               RxJS.map((_) => {
  //                 return {
  //                   followerId: undefined,
  //                   socialProfile: undefined,
  //                   socialLively: socialLively,
  //                   twitterUser: twitterUser
  //                 }
  //               })
  //             ),
  //           )
  //         })
  //       ),
  //     ),
  //     RxJS.tap((inputObj) => this._logger.log(`twitter follower received, username: ${inputObj.socialProfile.username}`)),
  //     RxJS.concatMap((inputData) => {
  //       return RxJS.merge(
  //         RxJS.of(inputData).pipe(
  //           RxJS.filter((value)=> !value.followerId && !!value.socialProfile),
  //           RxJS.map((inputObj) => {
  //             inputObj.socialProfile.socialId = inputObj.twitterUser.id;
  //             inputObj.socialProfile.socialName = inputObj.twitterUser.name;
  //             inputObj.socialProfile.profileUrl = "https://twitter.com/" + inputObj.socialProfile.username;
  //             inputObj.socialProfile.location = inputObj.twitterUser.location;
  //             inputObj.socialProfile.website = inputObj.twitterUser.entities?.url?.urls[0]?.expanded_url;
  //             this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter follower found, id: ${inputObj.socialProfile.id}, username: ${inputObj.socialProfile.username}`);
  //             let socialFollower = new SocialFollowerEntity();
  //             socialFollower.socialProfile = inputObj.socialProfile;
  //             socialFollower.socialLively = inputObj.socialLively;
  //             return [inputObj, socialFollower]
  //           }),
  //           RxJS.concatMap(([filterData, socialFollower]) => {
  //             return RxJS.from(
  //               this._entityManager.connection.transaction(async (manager) => {
  //                 await manager.createQueryBuilder()
  //                   .insert()
  //                   .into(SocialFollowerEntity)
  //                   .values([socialFollower])
  //                   .execute();
  //
  //                 await manager.createQueryBuilder()
  //                   .update(SocialProfileEntity)
  //                   .set(filterData.socialProfile)
  //                   .where("id = :id", { id: filterData.socialProfile.id })
  //                   .execute();
  //               })
  //             ).pipe(
  //               RxJS.map((result) => {
  //                 this._logger.log(`result update: ${result}`);
  //                 return {
  //                   socialProfile: filterData.socialProfile,
  //                   // @ts-ignore
  //                   followerId: socialFollower.id
  //                 };
  //               })
  //             )
  //           }),
  //         ),
  //         RxJS.of(inputData).pipe(
  //           RxJS.filter((value)=> !value.followerId && !(!!value.socialProfile)),
  //           RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
  //           RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower hasn't still registered, username: ${inputData.twitterUser.username}`))
  //         ),
  //         RxJS.of(inputData).pipe(
  //           RxJS.filter((value)=> value.followerId && !!value.socialProfile),
  //           RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
  //           RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower already has registered, username: ${inputData.twitterUser.username}`))
  //         )
  //       )
  //     })
  //     // retryWithDelay(30000, 7)
  //     // ).subscribe((value) => console.log(`subscribe to rx, value: ${value}`));
  //   ).subscribe({
  //     next: (inputData: {socialProfile: SocialProfileEntity, followerId: string}) => {
  //       if (inputData && inputData.followerId) {
  //         this._logger.log(`new follower persist successfully, id: ${inputData.followerId}`);
  //       } else if (inputData && inputData.socialProfile){
  //         this._logger.log(`social profile has updated successfully, username: ${inputData.socialProfile.username}`);
  //       }},
  //     error: (error) => this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, error: ${error}`),
  //     complete: () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
  //   });
  //
  //   // ).subscribe(([socialProfile, followerId]: [SocialProfileEntity, string]) => {
  //   //   if (followerId) {
  //   //     this._logger.log(`new follower persist successfully, id: ${followerId}`);
  //   //   } else if (socialProfile){
  //   //     this._logger.log(`social profile has updated successfully, username: ${socialProfile.username}`);
  //   //   }},
  //   //   (error) => this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, error: ${error}`),
  //   //   () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
  //   // );
  // }
  //

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
              this._logger.error(`fetch follower from twitter failed, error: ${current?.error?.cause}`)
              this._logger.log(`fetch follower retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }
}

