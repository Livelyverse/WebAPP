import { Injectable, Logger } from "@nestjs/common";
import { EntityManager, Repository } from "typeorm";
import { SocialFollowerEntity } from "../../entity/socialFollower.entity";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TwitterApi, UserV2FollowResult } from "twitter-api-v2";
import TwitterApiv2ReadOnly from "twitter-api-v2/dist/v2/client.v2.read";
import * as RxJS from "rxjs";
import { SocialProfileEntity, SocialType } from "../../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { UserV2 } from "twitter-api-v2/dist/types/v2/user.v2.types";
import * as Rxjs from "rxjs";
import { TypeORMError } from "typeorm/error/TypeORMError";

@Injectable()
export class TwitterFollowerTask {
  private readonly _logger = new Logger(TwitterFollowerTask.name);
  private readonly _entityManager: EntityManager
  private readonly _configService: ConfigService;
  private readonly _authToken: string
  private readonly _userid: string
  private readonly _username: string
  private readonly _twitterClient: TwitterApiv2ReadOnly

  constructor(
    @InjectRepository(SocialFollowerEntity)
    private readonly followerRepository,
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

    this._userid = this._configService.get<string>('airdrop.twitter.userId');
    if (!this._userid) {
      throw new Error("airdrop.twitter.userId config is empty");
    }

    this._username = this._configService.get<string>('airdrop.twitter.username');
    if (!this._username) {
      throw new Error("airdrop.twitter.username config is empty");
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
        RxJS.from(this._twitterClient.followers(socialLively.userId, {
          max_results: 128,
          asPaginator: true,
          "user.fields": ["id", "name", "username", "url", "location", "entities"]})
        ).pipe(
          RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
          RxJS.switchMap((paginator) => {
            this._logger.log(`paginator data count: ${paginator.meta.result_count}`)
            return RxJS.from(paginator.users)
              .pipe(Rxjs.map((follower) => [socialLively, follower]))
          }),
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
      RxJS.tap((inputObj) => this._logger.log(`twitter follower received, username: ${inputObj.socialProfile.username}`)),
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
              this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter follower found, id: ${inputObj.socialProfile.id}, username: ${inputObj.socialProfile.username}`);
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
          RxJS.of(inputData).pipe(
            RxJS.filter((value)=> value.followerId && !!value.socialProfile),
            RxJS.map((filterData) => {filterData.socialProfile, filterData.followerId}),
            RxJS.tap((mapData) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower already has registered, username: ${inputData.twitterUser.username}`))
          )
        )
      })
      // retryWithDelay(30000, 7)
      // ).subscribe((value) => console.log(`subscribe to rx, value: ${value}`));
    ).subscribe({
      next: (inputData: {socialProfile: SocialProfileEntity, followerId: string}) => {
        if (inputData && inputData.followerId) {
          this._logger.log(`new follower persist successfully, id: ${inputData.followerId}`);
        } else if (inputData && inputData.socialProfile){
          this._logger.log(`social profile has updated successfully, username: ${inputData.socialProfile.username}`);
        }},
      error: (error) => this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, error: ${error}`),
      complete: () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
    });

    // ).subscribe(([socialProfile, followerId]: [SocialProfileEntity, string]) => {
    //   if (followerId) {
    //     this._logger.log(`new follower persist successfully, id: ${followerId}`);
    //   } else if (socialProfile){
    //     this._logger.log(`social profile has updated successfully, username: ${socialProfile.username}`);
    //   }},
    //   (error) => this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, error: ${error}`),
    //   () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
    // );
  }

  // @Cron(CronExpression.EVERY_10_MINUTES)
  // fetchLivelyVerseTwitterFollowers() {
  //   RxJS.from(RxJS.from(this.entityManager.createQueryBuilder(SocialLivelyEntity, "socialLively")
  //       .where('"socialLively"."socialType" = \'TWITTER\'')
  //       .andWhere('"socialLively"."isActive" = \'true\'')
  //       .getOneOrFail())
  //     .pipe(
  //       RxJS.tap((socialLively) => this._logger.log(`fetch social lively: ${socialLively}`))
  //     )
  //   ).pipe(
  //     RxJS.concatMap((socialLively) =>
  //       RxJS.from(this._twitterClient.followers(socialLively.userId, {
  //         max_results: 128,
  //         asPaginator: true,
  //         "user.fields": ["id", "name", "username", "url", "location", "entities"]})
  //       )
  //       .pipe(
  //         RxJS.expand((paginator) => !paginator.done ? RxJS.from(paginator.next()) : RxJS.EMPTY),
  //         RxJS.concatMap((paginator) => {
  //           this._logger.log(`paginator data count: ${paginator.meta.result_count}`)
  //           return RxJS.from(paginator.users)
  //             .pipe(Rxjs.map((follower) => [socialLively, follower]))
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
  //         RxJS.map((socialProfileExt) => {
  //           if (socialProfileExt) {
  //             let { followerId: followerId, ...socialProfile } = socialProfileExt;
  //             return [followerId, socialProfile, socialLively, twitterUser];
  //           } else {
  //             return [undefined, undefined, socialLively, twitterUser];
  //           }
  //         })
  //       )
  //     ),
  //     // RxJS.take(1),
  //     RxJS.tap((tuple) => this._logger.log(`track twitter user: ${tuple[3].username}, socialLively id: ${tuple[2].id}`)),
  //     RxJS.map((tuple: [string, SocialProfileEntity, SocialLivelyEntity, UserV2]) => {
  //       let [followerId, socialProfile, socialLively, twitterUser] = tuple;
  //       if (socialProfile) {
  //         socialProfile.socialId = twitterUser.id;
  //         socialProfile.socialName = twitterUser.name;
  //         socialProfile.profileUrl = "https://twitter.com/" + socialProfile.username;
  //         socialProfile.location = twitterUser.location;
  //         socialProfile.website = twitterUser.entities?.url?.urls[0]?.expanded_url;
  //
  //       } else {
  //         socialProfile = new SocialProfileEntity();
  //         socialProfile.id = "c5306829-a8d7-45b2-93ae-bc88e51f610f";
  //         socialProfile.socialId = twitterUser.id;
  //         socialProfile.socialName = twitterUser.name;
  //         socialProfile.profileUrl = "https://twitter.com/" + socialProfile.username;
  //         socialProfile.location = twitterUser.location;
  //         socialProfile.website = twitterUser.entities?.url?.urls[0]?.expanded_url;
  //       }
  //
  //       if (socialLively) {
  //         socialLively.id = "bba8af4b-eff3-4d0c-9535-167f455224ef";
  //       } else {
  //         socialLively = new SocialLivelyEntity();
  //         socialLively.id = "bba8af4b-eff3-4d0c-9535-167f455224ef";
  //       }
  //
  //       let socialFollower = new SocialFollowerEntity();
  //       socialFollower.socialProfile = socialProfile;
  //       socialFollower.socialLively = socialLively;
  //       return [followerId, socialProfile, socialLively, twitterUser, socialFollower]
  //     }),
  //     // @ts-ignore
  //     RxJS.tap((tuple) => this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter username: ${tuple[3].username}, socialFollower: ${tuple[2]?.socialLively?.id}`)),
  //     RxJS.concatMap((tuple) => {
  //       // return RxJS.merge(
  //       return RxJS.of(tuple).pipe(
  //         // @ts-ignore
  //         RxJS.tap((tuple) =>  this._logger.log(`concatMap socialFollower: ${tuple[4].id}`)),
  //           // RxJS.filter(([followerId, socialProfile, socialLively, twitterUser])=> !followerId && !!socialProfile),
  //           // RxJS.switchMap(([followerId, socialProfile, socialLively, twitterUser]: [string, SocialProfileEntity, SocialLivelyEntity, UserV2]) => {
  //           //   RxJS.map(([followerId, socialProfile, socialLively, twitterUser]: [string, SocialProfileEntity, SocialLivelyEntity, UserV2]) => {
  //           //     socialProfile.socialId = twitterUser.id;
  //           //     socialProfile.socialName = twitterUser.name;
  //           //     socialProfile.profileUrl = "https://twitter.com/" + socialProfile.username;
  //           //     socialProfile.location = twitterUser.location;
  //           //     socialProfile.website = twitterUser.entities?.url?.urls[0]?.expanded_url;
  //           //     this._logger.log(`fetchLivelyVerseTwitterFollowers => new twitter follower found, id: ${socialProfile.id}, username: ${socialProfile.username}`);
  //           //
  //           //     let socialFollower = new SocialFollowerEntity();
  //           //     socialFollower.socialProfile = socialProfile;
  //           //     socialFollower.socialLively = socialLively;
  //           //     return [followerId, socialProfile, socialLively, twitterUser, socialFollower]
  //           //   }),
  //             RxJS.mergeMap((tuple: [string, SocialProfileEntity, SocialLivelyEntity, UserV2, SocialFollowerEntity]) => {
  //             //   this._logger.log(`before save result . . . `);
  //               return RxJS.from(
  //                 (async () => {
  //                     // this._followerRepository.manager.transaction(async (manager) => {
  //                     // this._entityManager.transaction(async (manager) => {
  //
  //
  //                     let queryRunner = this._entityManager.connection.createQueryRunner();
  //                     await queryRunner.connect();
  //                     // lets now open a new transaction:
  //                     await queryRunner.startTransaction()
  //
  //                     try {
  //                       // execute some operations on this transaction:
  //                       let socialFollower = new SocialFollowerEntity();
  //                       socialFollower.socialProfile = tuple[1];
  //                       socialFollower.socialLively = tuple[2];
  //                       let result = await queryRunner.manager.getRepository(SocialFollowerEntity).insert(socialFollower)
  //                       this._logger.log(`save result: ${result}`)
  //                       // commit transaction now:
  //
  //                       await queryRunner.commitTransaction()
  //                     } catch (err) {
  //                       // since we have errors let's rollback changes we made
  //                       await queryRunner.rollbackTransaction()
  //                     } finally {
  //                       // you need to release query runner which is manually created:
  //                       await queryRunner.release();
  //                     }
  //                 })()
  //
  //             //   //   await manager.createQueryBuilder()
  //             //   //     .insert()
  //             //   //     .into(SocialFollowerEntity)
  //             //   //     .values([socialFollower])
  //             //   //     .execute()
  //             //   })
  //             ).pipe(
  //                 // RxJS.tap((result) => this._logger.log(`save result: ${JSON.stringify(result)}`)),
  //                 RxJS.map((result) => [tuple[2], tuple[4].id]))
  //             })
  //       )
  //               // await this._entityManager.transaction(async (manager) => {
  //               //   this._entityManager.getRepository(SocialFollowerEntity).save(socialFollower);
  //                 // this._logger.log(`fetchLivelyVerseTwitterFollowers => social profile updated, id: ${socialProfile.id}, username: ${socialProfile.username}`)
  //                 // let result = await manager.createQueryBuilder()
  //                 //   .update(SocialProfileEntity)
  //                 //   .set(socialProfile)
  //                 //   .where("id = :id", { id: socialProfile.id })
  //                 //   .execute()
  //                 // this._logger.log(`result update: ${result}`);
  //               // })
  //               // return [socialProfile, socialFollower.id];
  //             // })
  //           // })
  //         // )
  //         // RxJS.of([followerId, socialProfile, socialLively, twitterUser]).pipe(
  //         //   RxJS.filter(([followerId, socialProfile, socialLively, twitterUser])=> !followerId && !(!!socialProfile)),
  //         //   RxJS.map(([followerId, socialProfile, socialLively, twitterUser]) => [socialProfile, followerId]),
  //         //   RxJS.tap(([socialProfile, followerId]) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower hasn't still registered, username: ${twitterUser.username}`))
  //         // ),
  //         // RxJS.of([followerId, socialProfile, socialLively, twitterUser]).pipe(
  //         //   RxJS.filter(([followerId, socialProfile, socialLively, twitterUser])=> followerId && !!socialProfile),
  //         //   RxJS.map(([followerId, socialProfile, socialLively, twitterUser]) => [socialProfile, followerId]),
  //         //   RxJS.tap(([socialProfile, followerId]) => this._logger.log(`fetchLivelyVerseTwitterFollowers => twitter follower already has registered, username: ${twitterUser.username}`))
  //         // )
  //       // )
  //     }),
  //     // retryWithDelay(30000, 7)
  //   // ).subscribe((value) => console.log(`subscribe to rx, value: ${value}`));
  //     ).subscribe({
  //       next: ([socialProfile, followerId]) => {
  //           if (followerId) {
  //             this._logger.log(`new follower persist successfully, id: ${followerId}`);
  //           } else if (socialProfile){
  //             // @ts-ignore
  //             this._logger.log(`social profile has updated successfully, username: ${socialProfile.username}`);
  //           }},
  //       error: (error) => this._logger.error(`fetchLivelyVerseTwitterFollowers fetch followers failed, error: ${error}`),
  //       complete: () => this._logger.log(`fetchLivelyVerseTwitterFollowers fetch followers completed`)
  //     });
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
}

export function retryWithDelay<T>(delay: number, count = 1): Rxjs.MonoTypeOperatorFunction<T> {
  return (input) =>
    input.pipe(
      Rxjs.retryWhen((errors) =>
        errors.pipe(
          Rxjs.scan((acc, error) => ({ count: acc.count + 1, error }), {
            count: 0,
            error: undefined as any,
          }),
          Rxjs.tap((current) => {
            if (current.error instanceof TypeORMError || current.count > count) {
              throw current.error;
            }
          }),
          Rxjs.delay(delay)
        )
      )
    );
}
