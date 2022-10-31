import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { BaseEntity, SocialProfileEntity, UserEntity } from "../domain/entity";
import { SocialProfileCreateDto, SocialProfileUpdateDto } from "../domain/dto";
import { SocialType } from "../domain/entity/socialProfile.entity";
import { FindAllType, SortType } from "./IService";
import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm/find-options/FindOneOptions";

export enum SocialProfileSortBy {
  TIMESTAMP = 'createdAt',
  USERNAME = 'username',
  SOCIALNAME = 'socialName',
  SOCIALTYPE = 'socialType'
}


@Injectable()
export class SocialProfileService {

  private readonly _logger = new Logger(SocialProfileService.name);

  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {}

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SocialProfileSortBy,
    filterBy: SocialType
  ): RxJS.Observable<FindAllType<SocialProfileEntity>> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filter => !!filter),
        RxJS.switchMap(filter => RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
            .findAndCount({
              skip: offset,
              take: limit,
              order: {
                [sortBy]: sortType,
              },
              where: { socialType: filter }
            })
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filter => !filter),
        RxJS.switchMap(filter => RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
            .findAndCount({
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
        next: result => this._logger.debug(`findAll SocialProfile success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialProfile failed`, err)
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

  findTotal(): RxJS.Observable<number> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
      .count()
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findTotal SocialProfile success, total: ${result}`),
        error: err => this._logger.error(`findTotal SocialProfile failed`, err)
      }),
      RxJS.identity,
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  findById(id: string): RxJS.Observable<SocialProfileEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
      .findOne({
        where: { id: id }
      })
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findById SocialProfile failed, id: ${id}`, err)
      }),
      RxJS.catchError(error => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      ),
      RxJS.mergeMap(result =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => !queryResult),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
              statusCode: '404',
              message: 'Record Not Found',
              error: 'Not Found'
            }, HttpStatus.NOT_FOUND)))
          ),
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => !!queryResult),
            RxJS.identity
          )
        )
      ),
    )
  }

  find(option: FindManyOptions<SocialProfileEntity>): RxJS.Observable<SocialProfileEntity[]> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity).find(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialProfile failed, option: ${JSON.stringify(option)}`, err)
      }),
      RxJS.catchError(_ => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Something Went Wrong',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      ),
      RxJS.mergeMap(result =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => !queryResult || !queryResult.length),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
              statusCode: '404',
              message: 'Record Not Found',
              error: 'Not Found'
            }, HttpStatus.NOT_FOUND)))
          ),
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => queryResult && queryResult.length > 0),
            RxJS.identity
          )
        )
      ),
    )
  }

  findOne(option: FindOneOptions<SocialProfileEntity>): RxJS.Observable<SocialProfileEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity).findOne(option)).pipe(
        RxJS.tap({
          error: err => this._logger.error(`findOne SocialProfile failed, option: ${JSON.stringify(option)}`, err)
        }),
        RxJS.catchError(_ => RxJS.throwError(() => new HttpException(
          {
            statusCode: '500',
            message: 'Something Went Wrong',
            error: 'Internal Server Error'
          }, HttpStatus.INTERNAL_SERVER_ERROR))
      ),
      RxJS.mergeMap(result =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => !queryResult),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
              statusCode: '404',
              message: 'Record Not Found',
              error: 'Not Found'
            }, HttpStatus.NOT_FOUND)))
          ),
          RxJS.of(result).pipe(
            RxJS.filter(queryResult => !!queryResult),
            RxJS.identity
          )
        )
      ),
    )
  }

  create(user: UserEntity, socialProfileDto: SocialProfileCreateDto): RxJS.Observable<SocialProfileEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
        .findOne({
          relations: ['user'],
          where: {
            user: { id:  user.id },
            socialType: socialProfileDto.socialType
          }
        })
      ).pipe(
        RxJS.mergeMap(result =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter(socialFindResult => !!socialFindResult),
              RxJS.tap({
                next: socialFindResult => this._logger.debug(`request new SocialProfile already exist, request: ${JSON.stringify(socialProfileDto)}, id: ${socialFindResult.id}`),
              }),
              RxJS.mergeMap(_ =>
                RxJS.throwError(() =>
                  new HttpException({
                    statusCode: '400',
                    message: 'SocialProfile Already Exist',
                    error: 'Bad Request'
                  }, HttpStatus.BAD_REQUEST)
                )
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter(socialFindResult => !!!socialFindResult),
              RxJS.map(_ => socialProfileDto),
              RxJS.map(socialProfileDto => {
                const entity = new SocialProfileEntity();
                entity.user = user;
                entity.socialType = socialProfileDto.socialType;
                entity.username = socialProfileDto.username;
                entity.socialName = socialProfileDto?.socialName;
                entity.profileUrl = socialProfileDto?.profileUrl;
                entity.website = socialProfileDto?.website;
                entity.location = socialProfileDto?.location;
                return entity
              }),
              RxJS.mergeMap(entity =>
                RxJS.from(this._entityManager.getRepository(SocialProfileEntity).save(entity)).pipe(
                  RxJS.tap({
                    next: result => this._logger.debug(`create SocialProfile success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
                    error: err => this._logger.error(`create SocialProfile failed, username ${entity.username}, socialType: ${entity.socialType}`, err)
                  }),
                  RxJS.catchError(_ => RxJS.throwError(() =>
                    new HttpException({
                      statusCode: '500',
                      message: 'Something Went Wrong',
                      error: 'Internal Server Error'
                    }, HttpStatus.INTERNAL_SERVER_ERROR))
                  )
                )
              )
            )
          )
        ),
        RxJS.tap({
          error: err => this._logger.error(`create SocialProfile failed, username ${socialProfileDto.username}, socialType: ${socialProfileDto.socialType}`, err)
        }),
        RxJS.catchError(error =>
          RxJS.merge(
            RxJS.of(error).pipe(
              RxJS.filter(err => err instanceof HttpException),
              RxJS.mergeMap(err => RxJS.throwError(err)),
            ),
            RxJS.of(error).pipe(
              RxJS.filter(err => !(err instanceof HttpException)),
              RxJS.mergeMap(err =>
                RxJS.throwError(() => new HttpException(
                  {
                    statusCode: '500',
                    message: 'Something Went Wrong',
                    error: 'Internal Server Error'
                  }, HttpStatus.INTERNAL_SERVER_ERROR)
                )
              )
            )
          )
        ),
      )
  }

  update(dto: SocialProfileUpdateDto, user: UserEntity): RxJS.Observable<SocialProfileEntity> {
    return RxJS.of(dto).pipe(
      RxJS.mergeMap(socialProfileDto => RxJS.from(this.findOne({
        relations: {
          user: true,
        },
        where: {
          user: { id: user.id },
          socialType: dto.socialType
        }
      })).pipe(
          RxJS.tap({
            error: err => this._logger.error(`findOne SocialProfile failed, user.email: ${user.email}, social username ${dto.username}, Id: ${dto.socialType}`, err)
          }),
          RxJS.mergeMap(result =>
            RxJS.merge(
              RxJS.of(result).pipe(
                RxJS.filter(socialFindResult => !!!socialFindResult),
                RxJS.mergeMap(_ =>
                  RxJS.throwError(() =>
                    new HttpException({
                      statusCode: '404',
                      message: 'Record Not Found',
                      error: 'Not Found'
                    }, HttpStatus.NOT_FOUND)
                  )
                )
              ),
              RxJS.of(result).pipe(
                RxJS.filter(socialFindResult => !!socialFindResult),
                RxJS.mergeMap(socialFindResult =>
                  RxJS.merge(
                    RxJS.of(socialFindResult).pipe(
                      RxJS.filter(socialFindResult => socialFindResult.user.id === user.id),
                      RxJS.map(socialFindResult => [socialProfileDto, socialFindResult])
                    ),
                    RxJS.of(socialFindResult).pipe(
                      RxJS.filter(socialFindResult => socialFindResult.user.id !== user.id),
                      RxJS.mergeMap(_ =>
                        RxJS.throwError(() => new HttpException(
                          {
                            statusCode: '403',
                            message: 'Update Forbidden',
                            error: 'FORBIDDEN'
                          }, HttpStatus.FORBIDDEN)
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
        )),
      RxJS.map(([socialProfileDto, socialProfileEntity]) => {
        socialProfileEntity.website = socialProfileDto.website ? socialProfileDto.website : socialProfileEntity?.website;
        socialProfileEntity.username = socialProfileDto.username ? socialProfileDto.username : socialProfileEntity?.username;
        socialProfileEntity.socialName = socialProfileDto.socialName ? socialProfileDto.socialName : socialProfileEntity?.socialName;
        socialProfileEntity.profileUrl = socialProfileDto.profileUrl ? socialProfileDto.profileUrl : socialProfileDto?.profileUrl;
        socialProfileEntity.location = socialProfileDto.location ? socialProfileDto.location : socialProfileDto?.location;
        return socialProfileEntity
      }),
      RxJS.mergeMap((entity:SocialProfileEntity) =>
        RxJS.from(this._entityManager.getRepository(SocialProfileEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update SocialProfile success, user.email: ${user.email}, username: ${result.username}, socialType: ${result.socialType}`),
            error: err => this._logger.error(`update SocialProfile failed, user.email: ${user.email}, username ${entity.username} socialType: ${entity.socialType}`, err)
          }),
          RxJS.catchError(error =>
            RxJS.merge(
              RxJS.of(error).pipe(
                RxJS.filter(err => err instanceof HttpException),
                RxJS.mergeMap(err => RxJS.throwError(err)),
              ),
              RxJS.of(error).pipe(
                RxJS.filter(err => !(err instanceof HttpException)),
                RxJS.mergeMap(err =>
                  RxJS.throwError(() => new HttpException(
                    {
                      statusCode: '500',
                      message: 'Something Went Wrong',
                      error: 'Internal Server Error'
                    }, HttpStatus.INTERNAL_SERVER_ERROR)
                  )
                )
              )
            )
          ),
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`socialProfile update failed, user.email: ${user.email}, socialType: ${dto.socialType}`, err)
      }),
      RxJS.catchError(error =>
        RxJS.merge(
          RxJS.of(error).pipe(
            RxJS.filter(err => err instanceof HttpException),
            RxJS.mergeMap(err => RxJS.throwError(err)),
          ),
          RxJS.of(error).pipe(
            RxJS.filter(err => !(err instanceof HttpException)),
            RxJS.mergeMap(err =>
              RxJS.throwError(() => new HttpException(
                {
                  statusCode: '500',
                  message: 'Something Went Wrong',
                  error: 'Internal Server Error'
                }, HttpStatus.INTERNAL_SERVER_ERROR)
              )
            )
          )
        )
      ),
    )
  }

  // TODO implement it
  delete(id: string): RxJS.Observable<void> {
    return RxJS.throwError(() => new HttpException({
      statusCode: '501',
      message: 'Delete Not Implemented',
      error: 'NOT IMPLEMENTED'
    }, HttpStatus.NOT_IMPLEMENTED))
  }

  // TODO implement it
  remove(id: string): RxJS.Observable<void> {
    return RxJS.throwError(() => new HttpException({
      statusCode: '501',
      message: 'Remove Not Implemented',
      error: 'NOT IMPLEMENTED'
    }, HttpStatus.NOT_IMPLEMENTED));
  }
}
