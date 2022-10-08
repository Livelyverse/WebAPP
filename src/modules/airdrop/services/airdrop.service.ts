import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { FindAllType, IAirdropService, SortBy, SortType } from "./IAirdrop.service";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SocialAirdropEntity } from "../domain/entity/socialAirdrop.entity";
import * as RxJS from "rxjs";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { AirdropFilterType } from "../domain/dto/airdropInfoView.dto";
import { SocialAirdropRuleEntity } from "../domain/entity/socialAirdropRule.entity";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { SocialActionType } from "../domain/entity/enums";
import { BaseEntity, UserEntity } from "../../profile/domain/entity";
import { AirdropBalance, AirdropBalanceViewDto } from "../domain/dto/airdropBalanceView.dto";
import { SocialLivelyEntity } from "../domain/entity/socialLively.entity";

export type FindAllBalanceType = { data: Array<AirdropBalance>; total: number }

@Injectable()
export class AirdropService {

  private readonly _logger = new Logger(AirdropService.name);
  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {
  }

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
    filterBy: AirdropFilterType,
    filter: unknown,
  ): RxJS.Observable<FindAllType<SocialAirdropEntity>> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.USER_ID),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialAirdropEntity)
            .findAndCount({
              relations: [
                'airdropRule',
                'socialTracker',
                'blockchainTx'
              ],
              join: {
                alias: "airdrop",
                innerJoinAndSelect: {
                  airdropRule: "airdrop.airdropRule",
                  socialTracker: "airdrop.socialTracker",
                  blockchainTx: "airdrop.blockchainTx",
                  socialEvent: "socialTracker.socialEvent",
                  socialProfile: "socialTracker.socialProfile",
                  user: "socialProfile.user",
                  socialLively: "socialEvent.socialLively",
                },
              },
              loadEagerRelations: true,
              where: {
                socialTracker: {
                  socialProfile: {
                    user: {
                      id: filter as string
                    }
                  }
                }
              },
              skip: offset,
              take: limit,
              order: {
                [sortBy]: sortType,
              },
            })
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.SOCIAL_TYPE),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialAirdropEntity)
            .findAndCount({
              relations: [
                'airdropRule',
                'socialTracker',
                'blockchainTx'
              ],
              join: {
                alias: "airdrop",
                innerJoinAndSelect: {
                  airdropRule: "airdrop.airdropRule",
                  socialTracker: "airdrop.socialTracker",
                  blockchainTx: "airdrop.blockchainTx",
                  socialEvent: "socialTracker.socialEvent",
                  socialProfile: "socialTracker.socialProfile",
                  user: "socialProfile.user",
                  socialLively: "socialEvent.socialLively"
                },
              },
              loadEagerRelations: true,
              where: {
                socialTracker: {
                  socialEvent: {
                    socialLively: {
                      socialType: filter as SocialType
                    }
                  }
                }
              },
              skip: offset,
              take: limit,
              order: {
                [sortBy]: sortType,
              },
            })
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.SOCIAL_ACTION),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialAirdropEntity)
            .findAndCount({
              relations: [
                'airdropRule',
                'socialTracker',
                'blockchainTx'
              ],
              join: {
                alias: "airdrop",
                innerJoinAndSelect: {
                  airdropRule: "airdrop.airdropRule",
                  socialTracker: "airdrop.socialTracker",
                  blockchainTx: "airdrop.blockchainTx",
                  socialEvent: "socialTracker.socialEvent",
                  socialProfile: "socialTracker.socialProfile",
                  user: "socialProfile.user",
                  socialLively: "socialEvent.socialLively"
                },
              },
              loadEagerRelations: true,
              where: {
                socialTracker: {
                  actionType: filter as SocialActionType
                }
              },
              skip: offset,
              take: limit,
              order: {
                [sortBy]: sortType,
              },
            })
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => !!!filterByType),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialAirdropEntity)
            .findAndCount({
              relations: [
                'airdropRule',
                'socialTracker',
                'blockchainTx'
              ],
              join: {
                alias: "airdrop",
                innerJoinAndSelect: {
                  airdropRule: "airdrop.airdropRule",
                  socialTracker: "airdrop.socialTracker",
                  blockchainTx: "airdrop.blockchainTx",
                  socialEvent: "socialTracker.socialEvent",
                  socialProfile: "socialTracker.socialProfile",
                  user: "socialProfile.user",
                  socialLively: "socialEvent.socialLively"
                },
              },
              loadEagerRelations: true,
              skip: offset,
              take: limit,
              order: {
                [sortBy]: sortType,
              },
            })
          )
        )
      )
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll SocialAirdrop success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialAirdrop failed`, err)
      }),
      RxJS.map(result => ({data: result[0], total: result[1]})),
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  findAllBalance(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
    filterBy: AirdropFilterType,
    filter: unknown,
  ): RxJS.Observable<FindAllBalanceType> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.USER_ID),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!filterVal),
              RxJS.concatMap(filterVal =>
                RxJS.from(this._entityManager.createQueryBuilder(UserEntity, "users")
                  .select('"users"."id" as "userId", "users"."username" as "username"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('"users"."id" as "userId", sum("airdropRule"."amount") as "airdrops"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .innerJoin("social_profile", "profile",  '"profile"."id" = "tracker"."socialProfileId"')
                        .innerJoin('"public"."user"' , "users" ,'"users"."id" = "profile"."userId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .andWhere('"users"."id" = :userid', {userid: filterVal})
                        .groupBy('"users"."id"')
                    , "sub1", '"sub1"."userId" = "users"."id"')
                  .innerJoin(qb =>
                      qb.select('"users"."id" as "userId", sum("airdropRule"."amount") as "airdrops"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .innerJoin("social_profile", "profile",  '"profile"."id" = "tracker"."socialProfileId"')
                        .innerJoin('"public"."user"' , "users" ,'"users"."id" = "profile"."userId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .andWhere('"users"."id" = :userid', {userid: filter})
                        .groupBy('"users"."id"')
                    , "sub2", '"sub2"."userId" = "users"."id"')
                  .where('"users"."id" = :userid', {userid: filter})
                  .getRawOne()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance by userId filter failed, userId: ${filterVal}`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance by userId filter not found, userId: ${filterVal}`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance by userId filter found, userId: ${filterVal}, result: ${queryResult}`),
                        }),
                        RxJS.map(queryResult => ({data: [queryResult], total: 1}) )
                      ),
                    )
                  ),
                )
              )
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!!filterVal),
              RxJS.concatMap(_ =>
                RxJS.from(this._entityManager.createQueryBuilder(UserEntity, "users")
                  .select('"users"."id" as "userId"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('"users"."id" as "userId", sum("airdropRule"."amount") as "airdrops"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .innerJoin("social_profile", "profile",  '"profile"."id" = "tracker"."socialProfileId"')
                        .innerJoin('"public"."user"' , "users" ,'"users"."id" = "profile"."userId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .groupBy('"users"."id"')
                    , "sub1", '"sub1"."userId" = "users"."id"')
                  .innerJoin(qb =>
                      qb.select('"users"."id" as "userId", sum("airdropRule"."amount") as "airdrops"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .innerJoin("social_profile", "profile",  '"profile"."id" = "tracker"."socialProfileId"')
                        .innerJoin('"public"."user"' , "users" ,'"users"."id" = "profile"."userId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .groupBy('"users"."id"')
                    , "sub2", '"sub2"."userId" = "users"."id"')
                  .getRawMany()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance group by userId filter failed`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance group by userId filter not found`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance group by userId filter success, total: ${queryResult[1]}`),
                        }),
                        RxJS.map(queryResult => ({data: queryResult[0], total: queryResult[1]}) )
                      ),
                    )
                  ),
                )
              )
            ),
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.SOCIAL_TYPE),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!filterVal),
              RxJS.concatMap(filterVal =>
                RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "lively")
                  .select('"lively"."socialType" as "socialType"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"airdropRule"."socialType" as "socialType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .andWhere('"airdropRule"."socialType" = :socialType', {socialType: filterVal})
                        .groupBy('"airdropRule"."socialType"')
                    , "sub1", '"sub1"."socialType" = "lively"."socialType"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"airdropRule"."socialType" as "socialType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .andWhere('"airdropRule"."socialType" = :socialType', {socialType: filterVal})
                        .groupBy('"airdropRule"."socialType"')
                    , "sub2", '"sub2"."socialType" = "lively"."socialType"')
                  .getRawOne()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance by socialType filter failed, socialType: ${filterVal}`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance by socialType filter not found, socialType: ${filterVal}`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance by socialType filter found, socialType: ${filterVal}, result: ${JSON.stringify(queryResult)}`),
                        }),
                        RxJS.map(queryResult => ({data: [queryResult], total: 1}) )
                      ),
                    )
                  ),
                )
              )
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!!filterVal),
              RxJS.concatMap(_ =>
                RxJS.from(this._entityManager.createQueryBuilder(SocialLivelyEntity, "lively")
                  .select('"lively"."socialType" as "socialType"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"airdropRule"."socialType" as "socialType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .groupBy('"airdropRule"."socialType"')
                    , "sub1", '"sub1"."socialType" = "lively"."socialType"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"airdropRule"."socialType" as "socialType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .groupBy('"airdropRule"."socialType"')
                    , "sub2", '"sub2"."socialType" = "lively"."socialType"')
                  .getRawMany()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance group by socialType filter failed`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance group by socialType filter not found`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance by socialType filter found, total: ${queryResult[1]}`),
                        }),
                        RxJS.map(queryResult => ({data: queryResult[0], total: queryResult[1]}) )
                      ),
                    )
                  ),
                )
              )
            )
          )
        ),
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => filterByType == AirdropFilterType.SOCIAL_ACTION),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!filterVal),
              RxJS.concatMap(filterVal =>
                RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
                  .select('"airdropRule"."actionType" as "actionType"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"tracker"."actionType" as "actionType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .andWhere('"tracker"."actionType" = :actionType', {actionType: filterVal})
                        .groupBy('"tracker"."actionType"')
                    , "sub1", '"sub1"."actionType" = "airdropRule"."actionType"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"tracker"."actionType" as "actionType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .andWhere('"tracker"."actionType" = :actionType', {actionType: filterVal})
                        .groupBy('"tracker"."actionType"')
                    , "sub2", '"sub2"."actionType" = "airdropRule"."actionType"')
                  .getRawOne()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance by actionType filter failed, actionType: ${filterVal}`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance by actionType filter not found, socialType: ${filterVal}`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance by actionType filter found, actionType: ${filterVal}, result: ${JSON.stringify(queryResult)}`),
                        }),
                        RxJS.map(queryResult => ({data: [queryResult], total: 1}) )
                      ),
                    )
                  ),
                )
              )
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!!filterVal),
              RxJS.concatMap(_ =>
                RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
                  .select('"airdropRule"."actionType" as "actionType"')
                  .addSelect('"sub1"."airdrops" as "pending", "sub2"."airdrops" as "settlement"')
                  .addSelect('COALESCE("sub1"."airdrops",0) + COALESCE("sub2"."airdrops",0) as "total"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"tracker"."actionType" as "actionType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .where('"airdrop"."blockchainTxId" IS NULL')
                        .groupBy('"tracker"."actionType"')
                    , "sub1", '"sub1"."actionType" = "airdropRule"."actionType"')
                  .innerJoin(qb =>
                      qb.select('sum("airdropRule"."amount") as "airdrops"')
                        .addSelect('"tracker"."actionType" as "actionType"')
                        .from(SocialAirdropEntity, "airdrop")
                        .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                        .innerJoin("social_tracker", "tracker", '"tracker"."id" = "airdrop"."socialTrackerId"')
                        .where('"airdrop"."blockchainTxId" IS NOT NULL')
                        .groupBy('"tracker"."actionType"')
                    , "sub2", '"sub2"."actionType" = "airdropRule"."actionType"')
                  .getRawOne()
                ).pipe(
                  RxJS.tap( {
                    error: (error) => this._logger.error(`findAllBalance group by actionType filter failed`, error),
                  }),
                  RxJS.mergeMap((queryResult) =>
                    RxJS.merge(
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!!queryResult ),
                        RxJS.tap( {
                          next: (_) => this._logger.debug(`findAllBalance group by actionType filter not found`),
                        }),
                        RxJS.mergeMap((_) => RxJS.EMPTY)
                      ),
                      RxJS.of(queryResult).pipe(
                        RxJS.filter((queryResult) => !!queryResult ),
                        RxJS.tap( {
                          next: (queryResult) => this._logger.debug(`findAllBalance by actionType filter found, total: ${queryResult[1]}`),
                        }),
                        RxJS.map(queryResult => ({data: queryResult[0], total: queryResult[1]}) )
                      ),
                    )
                  ),
                )
              )
            )
          )
        ),
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterByType => !!!filterByType),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.createQueryBuilder(SocialAirdropRuleEntity, "airdropRule")
            .select(qb =>
                qb.select('sum("airdropRule"."amount") as "airdrops"')
                  .from(SocialAirdropEntity, "airdrop")
                  .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                  .where('"airdrop"."blockchainTxId" IS NULL')
                  .groupBy('"airdrop"."isActive"')
              , "pending")
            .addSelect(qb =>
                qb.select('sum("airdropRule"."amount") as "airdrops"')
                  .from(SocialAirdropEntity, "airdrop")
                  .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
                  .where('"airdrop"."blockchainTxId" IS NOT NULL')
                  .groupBy('"airdrop"."isActive"')
              , "settlement")
            .getRawOne()
          ).pipe(
            RxJS.tap( {
              error: (error) => this._logger.error(`findAllBalance failed`, error),
            }),
            RxJS.mergeMap((queryResult) =>
              RxJS.merge(
                RxJS.of(queryResult).pipe(
                  RxJS.filter((queryResult) => !!!queryResult ),
                  RxJS.tap( {
                    next: (_) => this._logger.debug(`findAllBalance filter not found`),
                  }),
                  RxJS.mergeMap((_) => RxJS.EMPTY)
                ),
                RxJS.of(queryResult).pipe(
                  RxJS.filter((queryResult) => !!queryResult ),
                  RxJS.tap( {
                    next: (queryResult) => this._logger.debug(`findAllBalance found, result: ${JSON.stringify(queryResult)}`),
                  }),
                  RxJS.map(queryResult => {
                    const total = queryResult[0] + queryResult[1]
                    return {
                      data: [{
                        pending: queryResult[0],
                        settlement: queryResult[1],
                        total
                      }],
                      total: 1
                    }
                  })
                ),
              )
            ),
          )
        )
      )
    ).pipe(
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }
}