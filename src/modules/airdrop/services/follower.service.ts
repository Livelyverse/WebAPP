import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { FindAllType, SortType } from "./IAirdrop.service";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import * as RxJS from "rxjs";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { SocialFollowerEntity } from "../domain/entity/socialFollower.entity";

export enum FollowerSortBy {
  TIMESTAMP = 'createdAt',
}

@Injectable()
export class FollowerService {

  private readonly _logger = new Logger(FollowerService.name);
  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {
  }

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: FollowerSortBy,
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
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }
}