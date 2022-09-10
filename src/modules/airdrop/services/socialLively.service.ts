import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { SocialLivelyEntity } from "../domain/entity/socialLively.entity";
import { FindAllResult, IAirdropService } from "./IAirdropService";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { SocialLivelyCreateDto } from "../domain/dto/socialLivelyCreate.dto";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { ValidationError } from "class-validator/types/validation/ValidationError";
import { SocialLivelyUpdateDto } from "../domain/dto/socialLivelyUpdate.dto";
import { SocialFollowerEntity } from "../domain/entity/socialFollower.entity";
import { SocialTrackerEntity } from "../domain/entity/socialTracker.entity";
import { SocialAirdropEntity } from "../domain/entity/socialAirdrop.entity";

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
    sortType: string,
    sortBy: string,
  ): RxJS.Observable<FindAllResult<SocialLivelyEntity>> {
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
          error: 'Internal Server'
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
          error: 'Internal Server'
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
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
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
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
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
          error: 'Internal Server'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  create(dto: SocialLivelyCreateDto): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.merge(
      RxJS.of(dto).pipe(
        RxJS.map(dto => SocialLivelyService.validateCreateDto(dto)),
        RxJS.filter(validateDto => !validateDto[0]),
        RxJS.tap({
          next: validateDto => this._logger.error(`create socialLively validation failed, errors: ${JSON.stringify(validateDto[1])}`)
        }),
        RxJS.mergeMap(validateDto =>
          RxJS.throwError(() =>
            new HttpException({
                statusCode: '400',
                message: 'Input Date Validation Failed',
                error: validateDto[1]
              },
              HttpStatus.BAD_REQUEST)
          )
        )
      ),
      RxJS.of(dto).pipe(
        RxJS.filter(socialLivelyDto => SocialLivelyService.validateCreateDto(socialLivelyDto)[0]),
        RxJS.mergeMap(socialLivelyDto =>
          RxJS.from(this._entityManager.getRepository(SocialLivelyEntity)
            .findOne({
              where: {
                username: socialLivelyDto.username,
                socialType: socialLivelyDto.socialType
              }
            })
          ).pipe(
            RxJS.tap({
              next: result => this._logger.debug(`create findOne success, , result: ${JSON.stringify(result)}`),
              error: err => this._logger.error(`create findOne failed, username ${dto.username}, socialType: ${dto.socialType}`, err)
            }),
            RxJS.mergeMap(result =>
              RxJS.merge(
                RxJS.of(result).pipe(
                  RxJS.filter(socialFindResult => !!socialFindResult),
                  RxJS.mergeMap(_ =>
                    RxJS.throwError(() =>
                        new HttpException({
                          statusCode: '400',
                          message: 'SocialLively Already Exist',
                          error: 'bad request'
                        }, HttpStatus.BAD_REQUEST)
                    )
                  )
                ),
                RxJS.of(result).pipe(
                  RxJS.filter(socialFindResult => !!!socialFindResult),
                  RxJS.map(_ => socialLivelyDto)
                )
              )
            ),
            RxJS.catchError(_ => RxJS.throwError(() =>
              new HttpException({
                statusCode: '500',
                message: 'Internal Server Error',
                error: 'Internal Server'
              }, HttpStatus.INTERNAL_SERVER_ERROR))
            )
          )
        ),
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
              next: result => this._logger.debug(`create save socialLively success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
              error: err => this._logger.error(`create save socialLively success, username ${dto.username}, socialType: ${dto.socialType}`, err)
            }),
            RxJS.catchError(_ => RxJS.throwError(() =>
              new HttpException({
                statusCode: '500',
                message: 'Internal Server Error',
                error: 'Internal Server'
              }, HttpStatus.INTERNAL_SERVER_ERROR))
            )
          )
        )
      )
    )
  }

  private static validateCreateDto(dto: SocialLivelyCreateDto): [boolean, ValidationError[]] {
    let validations: ValidationError[] = []
    if(dto.socialType === SocialType.TWITTER) {

      if(!dto.profileName) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'profileName',
          value: dto.profileName,
          constraints: {
            profileName: 'Twitter profileName must not empty'
          }
        }
        validations.push(validate);
      }

      if(!dto.userId) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'userId',
          value: dto.userId,
          constraints: {
            userId: 'Twitter userId must not empty'
          }
        }
        validations.push(validate);
      }

      if(!dto.profileUrl) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'profileUrl',
          value: dto.profileUrl,
          constraints: {
            profileUrl: 'Twitter profileUrl must not empty'
          }
        }
        validations.push(validate);
      }

      return [!!validations.length, validations]
    }
    return [true, null];
  }

  update(dto: SocialLivelyUpdateDto): RxJS.Observable<SocialLivelyEntity> {
    return RxJS.of(dto).pipe(
      RxJS.mergeMap(socialLivelyDto => RxJS.from(this.findById(dto.id)).pipe(
          RxJS.tap({
            error: err => this._logger.error(`update socialLively found, username ${dto.username}, socialType: ${dto.socialType}`, err)
          }),
          RxJS.mergeMap(result =>
            RxJS.merge(
              RxJS.of(result).pipe(
                RxJS.filter(socialFindResult => !!!socialFindResult),
                RxJS.mergeMap(_ =>
                  RxJS.throwError(() =>
                    new HttpException({
                      statusCode: '404',
                      message: 'SocialLively Not Found',
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
          RxJS.catchError(_ => RxJS.throwError(() =>
            new HttpException({
              statusCode: '500',
              message: 'Internal Server Error',
              error: 'Internal Server'
            }, HttpStatus.INTERNAL_SERVER_ERROR))
          )
        )
      ),
      RxJS.map(([socialLivelyDto, socialLivelyEntity]) => {
        socialLivelyEntity.userId = socialLivelyDto.userId;
        socialLivelyEntity.socialType = socialLivelyDto.socialType;
        socialLivelyEntity.username = socialLivelyDto.username;
        socialLivelyEntity.profileName = socialLivelyDto.profileName;
        socialLivelyEntity.profileUrl = socialLivelyDto.profileUrl;
        return socialLivelyEntity
      }),
      RxJS.mergeMap(entity =>
        RxJS.from(this._entityManager.getRepository(SocialLivelyEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update socialLively success, id: ${result.id}, username: ${result.username}, socialType: ${result.socialType}`),
            error: err => this._logger.error(`update socialLively failed, username ${dto.username}, socialType: ${dto.socialType}`, err)
          }),
          RxJS.catchError(_ => RxJS.throwError(() =>
            new HttpException({
              statusCode: '500',
              message: 'Internal Server Error',
              error: 'Internal Server'
            }, HttpStatus.INTERNAL_SERVER_ERROR))
          )
        )
      )
    )
  }

  delete(id: string): RxJS.Observable<void> {
    const socialLively = new SocialLivelyEntity();
    const socialFollower = new SocialFollowerEntity();
    const socialTracker = new SocialTrackerEntity();

    return RxJS.from(this._entityManager.transaction(async(manager) => {
      let deleteResult = await manager.getRepository(SocialLivelyEntity).softDelete(id);
      if(deleteResult.affected) {
        socialLively.id = id;
        deleteResult = await manager.getRepository(SocialFollowerEntity).softDelete({
          socialLively: socialLively
        })

        if(deleteResult.affected) {
          socialFollower.id = deleteResult.generatedMaps['id'];
          // @ts-ignore
          deleteResult = await manager.getRepository(SocialTrackerEntity).softDelete({
            follower: socialFollower
          })

          if(deleteResult.affected) {
            socialTracker.id = deleteResult.generatedMaps['id'];
            // @ts-ignore
            await manager.getRepository(SocialAirdropEntity).softDelete({
              socialTracker: socialTracker
            })
          }
        }
      }
    })).pipe(
      RxJS.tap({
        next: _ => this._logger.debug(`delete socialLively success, id: ${id}`),
        error: err => this._logger.error(`delete socialLively failed, id: ${id}`, err)
      }),
      RxJS.catchError(_ => RxJS.throwError(() =>
        new HttpException({
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  // deleteByName(name: string): RxJS.Observable<void> {
  //
  // }

  // TODO implement it
  remove(id: string): RxJS.Observable<void> {
    const socialLively = new SocialLivelyEntity();
    const socialFollower = new SocialFollowerEntity();
    const socialTracker = new SocialTrackerEntity();

    socialLively.id = id;
    return RxJS.EMPTY;
  }

  // removeByName(name: string): RxJS.Observable<void> {
  //
  // }
}
