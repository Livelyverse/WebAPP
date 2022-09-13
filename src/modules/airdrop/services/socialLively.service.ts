import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { SocialLivelyEntity } from "../domain/entity/socialLively.entity";
import { FindAllType, IAirdropService, SortBy, SortType } from "./IAirdropService";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SocialLivelyCreateDto } from "../domain/dto/socialLivelyCreate.dto";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyUpdateDto } from "../domain/dto/socialLivelyUpdate.dto";

@Injectable()
export class SocialLivelyService implements IAirdropService<SocialLivelyEntity>{

  private readonly _logger = new Logger(SocialLivelyService.name);

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
  ) {

  }

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
  ): RxJS.Observable<FindAllType<SocialLivelyEntity>> {
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
      .findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType,
        },
      })
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll SocialLively success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialLively failed`, err)
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
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
      .count()
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findTotal SocialLively success, total: ${result[1]}`),
        error: err => this._logger.error(`findTotal SocialLively failed`, err)
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

  findById(id: string): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
      .findOne({
        where: { id: id }
      })
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findById SocialLively failed, id: ${id}`, err)
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

  findBySocialType(socialType: SocialType): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
      .findOne({
        where: { socialType: socialType }
      })
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findBySocialType SocialLively failed, username: ${socialType}`, err)
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

  findOne(options: unknown): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
      .findOne(options)
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialLively failed, options: ${JSON.stringify(options)}`, err)
      }),
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  create(socialLivelyDto: SocialLivelyCreateDto): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
                  .findOne({ where: { socialType: socialLivelyDto.socialType } })
      ).pipe(
        RxJS.tap({
          error: err => this._logger.error(`findOne socialLively failed, username ${socialLivelyDto.username}, socialType: ${socialLivelyDto.socialType}`, err)
        }),
        RxJS.mergeMap(result =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter(socialFindResult => !!socialFindResult),
              RxJS.tap({
                next: socialFindResult => this._logger.debug(`request new SocialLively profile already exist, request: ${JSON.stringify(socialLivelyDto)}, id: ${socialFindResult.id}`),
              }),
              RxJS.mergeMap(_ =>
                RxJS.throwError(() =>
                    new HttpException({
                      statusCode: '400',
                      message: 'SocialLively Already Exist',
                      error: 'Bad Request'
                    }, HttpStatus.BAD_REQUEST)
                )
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter(socialFindResult => !!!socialFindResult),
              RxJS.map(_ => socialLivelyDto),
              RxJS.map(socialLivelyDto => {
                const entity = new SocialLivelyEntity();
                entity.userId = socialLivelyDto.userId;
                entity.socialType = socialLivelyDto.socialType;
                entity.username = socialLivelyDto.username;
                entity.profileName = socialLivelyDto.profileName;
                entity.profileUrl = socialLivelyDto.profileUrl;
                return entity
              }),
              RxJS.mergeMap(entity =>
                RxJS.from(this._entityManager.getRepository(SocialLivelyEntity).save(entity)).pipe(
                  RxJS.tap({
                    next: result => this._logger.debug(`create socialLively success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
                    error: err => this._logger.error(`create socialLively failed, username ${entity.username}, socialType: ${entity.socialType}`, err)
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

  update(dto: SocialLivelyUpdateDto): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.of(dto).pipe(
      RxJS.mergeMap(socialLivelyDto => RxJS.from(this.findById(dto.id)).pipe(
          RxJS.tap({
            error: err => this._logger.error(`update socialLively found, username ${dto.username}, Id: ${dto.id}`, err)
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
                RxJS.map(socialFindResult => [socialLivelyDto, socialFindResult])
              )
            )
          ),
        )),
      RxJS.map(([socialLivelyDto, socialLivelyEntity]) => {
        socialLivelyEntity.userId = socialLivelyDto.userId ? socialLivelyDto.userId : socialLivelyEntity.userId;
        socialLivelyEntity.username = socialLivelyDto.username ? socialLivelyDto.username : socialLivelyEntity.username;
        socialLivelyEntity.profileName = socialLivelyDto.profileName ? socialLivelyDto.profileName : socialLivelyEntity.profileName;
        socialLivelyEntity.profileUrl = socialLivelyDto.profileUrl ? socialLivelyDto.profileUrl : socialLivelyEntity.profileUrl;
        return socialLivelyEntity
      }),
      RxJS.mergeMap((entity:SocialLivelyEntity) =>
        RxJS.from(this._entityManager.getRepository(SocialLivelyEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update socialLively success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
            error: err => this._logger.error(`update socialLively failed, username ${entity.username}, socialType: ${entity.socialType}`, err)
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
