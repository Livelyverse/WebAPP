import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { BaseEntity, SocialProfileEntity, UserEntity } from "../domain/entity";
import { SocialProfileCreateDto, SocialProfileUpdateDto } from "../domain/dto";
import { SocialType } from "../domain/entity/socialProfile.entity";

export type FindAllType<T extends BaseEntity> = { data: Array<T>; total: number }

export enum SortBy {
  TIMESTAMP = 'createdAt',
}

export type SortType = 'ASC' | 'DESC'

@Injectable()
export class SocialProfileService {

  private readonly _logger = new Logger(SocialProfileService.name);

  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {}

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
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
          message: 'Internal Server Error',
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
          message: 'Internal Server Error',
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
          message: 'Internal Server Error',
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

  find(option: FindOptionsWhere<SocialProfileEntity>): RxJS.Observable<SocialProfileEntity[]> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity).findBy(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialProfile failed, option: ${JSON.stringify(option)}`, err)
      }),
      RxJS.catchError(_ => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
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

  findOne(option: FindOptionsWhere<SocialProfileEntity>): RxJS.Observable<SocialProfileEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity).findOneBy(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialProfile failed, option: ${JSON.stringify(option)}`, err)
      }),
      RxJS.catchError(_ => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
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

  create(socialProfileDto: SocialProfileCreateDto): RxJS.Observable<SocialProfileEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialProfileEntity)
        .findOne({
          relations: ['user'],
          where: {
            user: { id:  socialProfileDto.userId },
            socialType: socialProfileDto.socialType
          }
        })
      ).pipe(
        RxJS.tap({
          error: err => this._logger.error(`findOne SocialProfile failed, username ${socialProfileDto.username}, socialType: ${socialProfileDto.socialType}`, err)
        }),
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
                const user = new UserEntity();
                const entity = new SocialProfileEntity();
                user.id = socialProfileDto.userId;
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
                      message: 'Internal Server Error',
                      error: 'Internal Server Error'
                    }, HttpStatus.INTERNAL_SERVER_ERROR))
                  )
                )
              )
            )
          )
        ),
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
                    message: 'Internal Server Error',
                    error: 'Internal Server Error'
                  }, HttpStatus.INTERNAL_SERVER_ERROR)
                )
              )
            )
          )
        ),
      )
  }

  update(dto: SocialProfileUpdateDto): RxJS.Observable<SocialProfileEntity> {
    return RxJS.of(dto).pipe(
      RxJS.mergeMap(socialProfileDto => RxJS.from(this.findById(dto.id)).pipe(
          RxJS.tap({
            error: err => this._logger.error(`findById SocialProfile failed, social username ${dto.username}, Id: ${dto.id}`, err)
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
                RxJS.map(socialFindResult => [socialProfileDto, socialFindResult])
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
        return socialProfileDto
      }),
      RxJS.mergeMap((entity:SocialProfileEntity) =>
        RxJS.from(this._entityManager.getRepository(SocialProfileEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update SocialProfile success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
            error: err => this._logger.error(`update SocialProfile failed, id: ${entity.id}, username ${entity.username} socialType: ${entity.socialType}`, err)
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
                      message: 'Internal Server Error',
                      error: 'Internal Server Error'
                    }, HttpStatus.INTERNAL_SERVER_ERROR)
                  )
                )
              )
            )
          ),
        )
      )
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
      message: 'Delete Not Implemented',
      error: 'NOT IMPLEMENTED'
    }, HttpStatus.NOT_IMPLEMENTED));
  }
}
