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
import { SocialFollowerEntity } from "../domain/entity/socialFollower.entity";

@Injectable()
export class FollowerService {

  private readonly _logger = new Logger(FollowerService.name);
  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {
  }

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
    filter: SocialType,
  ): RxJS.Observable<FindAllType<SocialFollowerEntity>> {
    return RxJS.merge(
      RxJS.of(filter).pipe(
        RxJS.filter(filterType => !!filterType),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialFollowerEntity)
            .findAndCount({
              relations: [
                'socialProfile',
                'socialLively',
              ],
              join: {
                alias: "follower",
                innerJoinAndSelect: {
                  socialProfile: "follower.socialProfile",
                  socialLively: "follower.socialLively",
                  user: "socialProfile.user",
                },
              },
              loadEagerRelations: true,
              where: {
                socialLively: {
                  socialType: filter
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
      RxJS.of(filter).pipe(
        RxJS.filter(filterType => !filterType),
        RxJS.concatMap(_ =>
          RxJS.from(this._entityManager.getRepository(SocialFollowerEntity)
            .findAndCount({
              relations: [
                'socialProfile',
                'socialLively',
              ],
              join: {
                alias: "follower",
                innerJoinAndSelect: {
                  socialProfile: "follower.socialProfile",
                  socialLively: "follower.socialLively",
                  user: "socialProfile.user",
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
        next: result => this._logger.debug(`findAll SocialFollower success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialFollower failed`, err)
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
}