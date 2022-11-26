import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { SocialLivelyEntity } from "../domain/entity/socialLively.entity";
import { FindAllType, IAirdropService, SortType } from "./IAirdrop.service";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager, MoreThanOrEqual } from "typeorm";
import { AirdropHashtagsValueObject, SocialAirdropScheduleEntity } from "../domain/entity/socialAirdropSchedule.entity";
import { AirdropScheduleCreateDto } from "../domain/dto/airdropScheduleCreate.dto";
import { AirdropScheduleUpdateDto } from "../domain/dto/airdropScheduleUpdate.dto";
import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm/find-options/FindOneOptions";

export enum AirdropScheduleSortBy {
  TIMESTAMP = 'createdAt',
  SOCIALTYPE = 'socialType',
  AIRDROP_START = 'airdropStartAt',
  AIRDROP_END = 'airdropEndAt'
}

@Injectable()
export class AirdropScheduleService implements IAirdropService<SocialAirdropScheduleEntity>{

  private readonly _logger = new Logger(SocialAirdropScheduleEntity.name);

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
  ) {

  }

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: AirdropScheduleSortBy,
  ): RxJS.Observable<FindAllType<SocialAirdropScheduleEntity>> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
      .findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType,
        },
      })
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll SocialAirdropSchedule success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialAirdropSchedule failed`, err)
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
    return RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
      .count()
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findTotal SocialAirdropSchedule success, total: ${result}`),
        error: err => this._logger.error(`findTotal SocialAirdropSchedule failed`, err)
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

  findById(id: string): RxJS.Observable<SocialAirdropScheduleEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
      .findOne({
        where: { id: id }
      })
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findById SocialAirdropSchedule failed, id: ${id}`, err)
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

  find(option: FindManyOptions<SocialAirdropScheduleEntity>): RxJS.Observable<SocialAirdropScheduleEntity[]> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity).find(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialAirdropSchedule failed, option: ${JSON.stringify(option)}`, err)
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

  findOne(option: FindOneOptions<SocialAirdropScheduleEntity>): RxJS.Observable<SocialAirdropScheduleEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity).findOne(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialAirdropSchedule failed, option: ${JSON.stringify(option)}`, err)
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

  create(airdropScheduleDto: AirdropScheduleCreateDto): RxJS.Observable<SocialAirdropScheduleEntity> {
    return RxJS.zip(
      RxJS.from(this._entityManager.getRepository(SocialLivelyEntity).findOne({
        where: {
          socialType: airdropScheduleDto.socialType
        }
      })).pipe(
        RxJS.tap({
          error: err => this._logger.error(`find social lively failed, social: ${airdropScheduleDto.socialType}`, err)
        }),
        RxJS.mergeMap(findResult =>
          RxJS.merge(
            RxJS.of(findResult).pipe(
              RxJS.filter(socialLively => !socialLively),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException(
                {
                  statusCode: '400',
                  message: `Social Lively ${airdropScheduleDto.socialType} Not Found`,
                  error: 'Bad Request'
                }, HttpStatus.BAD_REQUEST)
              ))
            ),
            RxJS.of(findResult).pipe(
              RxJS.filter(socialLively => !!socialLively),
              RxJS.identity,
            )
          )
        )
      ),
      RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity)
        .findOne({
          relations: {
            socialLively: true
          },
          where: {
            socialLively: {
              socialType: airdropScheduleDto.socialType
            },
            airdropEndAt: MoreThanOrEqual(airdropScheduleDto.airdropStartAt)
          }
        })
      ).pipe(
        RxJS.tap({
          error: err => this._logger.error(`findOne socialAirdropSchedule failed, airdropName ${airdropScheduleDto.airdropName}, socialType: ${airdropScheduleDto.socialType}`, err)
        }),
      )
    ).pipe(
      RxJS.mergeMap(([socialLively, result]) =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(airdropScheduleResult => !!airdropScheduleResult),
            RxJS.tap({
            }),
            RxJS.mergeMap(_ =>
              RxJS.throwError(() =>
                  new HttpException({
                    statusCode: '400',
                    message: 'SocialAirdropSchedule Already Exist',
                    error: 'Bad Request'
                  }, HttpStatus.BAD_REQUEST)
              )
            )
          ),
          RxJS.of(result).pipe(
            RxJS.filter(airdropScheduleResult => !airdropScheduleResult),
            RxJS.map(_ => {
              const entity = new SocialAirdropScheduleEntity();
              entity.airdropName = airdropScheduleDto.airdropName;
              entity.description = airdropScheduleDto?.description ? airdropScheduleDto.description : null;
              entity.hashtags = new AirdropHashtagsValueObject();
              entity.hashtags.airdrop = airdropScheduleDto.hashtags.airdrop;
              entity.hashtags.join = airdropScheduleDto.hashtags?.join ? airdropScheduleDto.hashtags.join : null;
              entity.hashtags.comment = airdropScheduleDto.hashtags?.comment ? airdropScheduleDto.hashtags.comment : null;
              entity.airdropStartAt = airdropScheduleDto.airdropStartAt;
              entity.airdropEndAt = airdropScheduleDto.airdropEndAt;
              entity.socialLively = socialLively;
              return entity
            }),
            RxJS.mergeMap(entity =>
              RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity).save(entity)).pipe(
                RxJS.tap({
                  next: result => this._logger.debug(`create socialAirdropSchedule success, id: ${result.id}, airdropName: ${result.airdropName}, socialType: ${result.socialLively.socialType}`),
                  error: err => this._logger.error(`create socialAirdropSchedule failed, airdropName: ${entity.airdropName}, socialType: ${entity.socialLively.socialType}`, err)
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
      RxJS.catchError(error =>
        RxJS.merge(
          RxJS.of(error).pipe(
            RxJS.filter(err => err instanceof HttpException),
            RxJS.mergeMap(err => RxJS.throwError(err)),
          ),
          RxJS.of(error).pipe(
            RxJS.filter(err => !(err instanceof HttpException)),
            RxJS.mergeMap(_ =>
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

  update(dto: AirdropScheduleUpdateDto): RxJS.Observable<SocialAirdropScheduleEntity> {
    return RxJS.zip(
      RxJS.from(this._entityManager.getRepository(SocialLivelyEntity).findOneOrFail({
        where: {
          socialType: dto.socialType
        }
      })).pipe(
        RxJS.tap({
          error: err => this._logger.error(`find social lively failed, social: ${dto.socialType}`, err)
        }),
        RxJS.mergeMap(findResult =>
          RxJS.merge(
            RxJS.of(findResult).pipe(
              RxJS.filter(socialLively => !socialLively),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException(
                {
                  statusCode: '400',
                  message: `Social Lively ${dto.socialType} Not Found`,
                  error: 'Bad Request'
                }, HttpStatus.BAD_REQUEST)
              ))
            ),
            RxJS.of(findResult).pipe(
              RxJS.filter(socialLively => !!socialLively),
              RxJS.identity,
            )
          )
        )
      ),
      RxJS.from(this.findById(dto.id)).pipe(
          RxJS.tap({
            error: err => this._logger.error(`findById socialAirdropSchedule failed, Id: ${dto.id}`, err)
        }),
      )
    ).pipe(
      RxJS.mergeMap(([socialLively, findResult]) =>
        RxJS.merge(
          RxJS.of(findResult).pipe(
            RxJS.filter(airdropScheduleEntity => !airdropScheduleEntity),
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
          RxJS.of(findResult).pipe(
            RxJS.filter(airdropScheduleEntity => !!airdropScheduleEntity),
            RxJS.map(airdropScheduleEntity => [socialLively, dto, airdropScheduleEntity])
          )
        )
      ),
      RxJS.map(([socialLively, airdropScheduleDto,airdropScheduleEntity]:[SocialLivelyEntity, AirdropScheduleUpdateDto, SocialAirdropScheduleEntity]) => {
        airdropScheduleEntity.airdropName = airdropScheduleDto?.airdropName ? airdropScheduleDto.airdropName : airdropScheduleEntity.airdropName;
        airdropScheduleEntity.description = airdropScheduleDto?.description ? airdropScheduleDto.description : airdropScheduleEntity.description;
        airdropScheduleEntity.hashtags.airdrop = airdropScheduleDto.hashtags?.airdrop ? airdropScheduleDto.hashtags.airdrop : airdropScheduleEntity.hashtags.airdrop;
        airdropScheduleEntity.hashtags.join = airdropScheduleDto.hashtags?.join ? airdropScheduleDto.hashtags.join : airdropScheduleEntity.hashtags.join;
        airdropScheduleEntity.hashtags.comment = airdropScheduleDto.hashtags?.comment ? airdropScheduleDto.hashtags.comment : airdropScheduleEntity.hashtags.comment;
        airdropScheduleEntity.airdropStartAt = airdropScheduleDto?.airdropStartAt ? airdropScheduleDto.airdropStartAt : airdropScheduleEntity.airdropStartAt;
        airdropScheduleEntity.airdropEndAt = airdropScheduleDto?.airdropEndAt ? airdropScheduleDto.airdropEndAt : airdropScheduleEntity.airdropEndAt;
        airdropScheduleEntity.socialLively = socialLively;
        return airdropScheduleEntity;
      }),
      RxJS.mergeMap((entity:SocialAirdropScheduleEntity) =>
        RxJS.from(this._entityManager.getRepository(SocialAirdropScheduleEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update socialAirdropSchedule success, id: ${result.id}, airdropName: ${result.airdropName}, socialType: ${result.socialLively.socialType}`),
            error: err => this._logger.error(`update socialAirdropSchedule failed, airdropName ${entity.airdropName}, socialType: ${entity.socialLively.socialType}`, err)
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
