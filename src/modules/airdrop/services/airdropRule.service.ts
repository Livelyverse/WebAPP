import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { FindAllType, IAirdropService, SortType } from "./IAirdrop.service";
import * as RxJS from "rxjs";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { AirdropRuleCreateDto } from "../domain/dto/airdropRuleCreate.dto";
import { SocialAirdropRuleEntity } from "../domain/entity/socialAirdropRule.entity";
import { AirdropRuleUpdateDto } from "../domain/dto/airdropRuleUpdate.dto";
import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm/find-options/FindOneOptions";

export enum AirdropRuleSortBy {
  TIMESTAMP = 'createdAt',
  SOCIAL_TYPE = 'socialType',
  ACTION_TYPE = 'actionType'
}

@Injectable()
export class AirdropRuleService implements IAirdropService<SocialAirdropRuleEntity>{

  private readonly _logger = new Logger(AirdropRuleService.name);
  constructor(@InjectEntityManager() private readonly _entityManager: EntityManager) {}

  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: AirdropRuleSortBy,
  ): RxJS.Observable<FindAllType<SocialAirdropRuleEntity>> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity)
      .findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType,
        },
      })
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll SocialAirdropRule success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll SocialAirdropRule failed`, err)
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
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity)
      .count()
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findTotal SocialAirdropRule success, total: ${result}`),
        error: err => this._logger.error(`findTotal SocialAirdropRule failed`, err)
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

  findById(id: string): RxJS.Observable<SocialAirdropRuleEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity)
      .findOne({
        where: { id: id }
      })
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findById SocialAirdropRule failed, id: ${id}`, err)
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
  
  find(option: FindManyOptions<SocialAirdropRuleEntity>): RxJS.Observable<SocialAirdropRuleEntity[]> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity).find(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialAirdropRule failed, option: ${JSON.stringify(option)}`, err)
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

  findOne(option: FindOneOptions<SocialAirdropRuleEntity>): RxJS.Observable<SocialAirdropRuleEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity).findOne(option)).pipe(
      RxJS.tap({
        error: err => this._logger.error(`findOne SocialAirdropRule failed, option: ${JSON.stringify(option)}`, err)
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

  create(airdropRuleDto: AirdropRuleCreateDto): RxJS.Observable<SocialAirdropRuleEntity> {
    return RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity)
        .findOne({ 
          where: { 
            socialType: airdropRuleDto.socialType,
            actionType: airdropRuleDto.actionType
          } 
        })
      ).pipe(
        RxJS.tap({
          error: err => this._logger.error(`findOne SocialAirdropRule failed, actionType ${airdropRuleDto.actionType}, socialType: ${airdropRuleDto.socialType}`, err)
        }),
        RxJS.mergeMap(result =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter(socialAirdropFindResult => !!socialAirdropFindResult),
              RxJS.tap({
                next: socialAirdropFindResult => this._logger.debug(`request new SocialAirdropRule already exist, request: ${JSON.stringify(airdropRuleDto)}, id: ${socialAirdropFindResult.id}`),
              }),
              RxJS.mergeMap(_ =>
                RxJS.throwError(() =>
                    new HttpException({
                      statusCode: '400',
                      message: 'SocialAirdropRule Already Exist',
                      error: 'Bad Request'
                    }, HttpStatus.BAD_REQUEST)
                )
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter(socialAirdropFindResult => !!!socialAirdropFindResult),
              RxJS.map(_ => airdropRuleDto),
              RxJS.map(socialAirdropRuleDto => {
                const entity = new SocialAirdropRuleEntity();
                entity.socialType = socialAirdropRuleDto.socialType;
                entity.actionType = socialAirdropRuleDto.actionType;
                entity.unit = socialAirdropRuleDto.unit;
                entity.amount = BigInt(socialAirdropRuleDto.amount);
                entity.decimal = socialAirdropRuleDto.decimal;
                return entity
              }),
              RxJS.mergeMap(entity =>
                RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity).save(entity)).pipe(
                  RxJS.tap({
                    next: result => this._logger.debug(`create SocialAirdropRule success, id: ${result.id}, actionType: ${result.actionType}, socialType: ${result.socialType}`),
                    error: err => this._logger.error(`create SocialAirdropRule failed, actionType ${entity.actionType}, socialType: ${entity.socialType}`, err)
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

  update(airdropRuleDto: AirdropRuleUpdateDto): RxJS.Observable<SocialAirdropRuleEntity> {
    return RxJS.of(airdropRuleDto).pipe(
      RxJS.mergeMap(socialAirdropRuleDto => RxJS.from(this.findById(socialAirdropRuleDto.id)).pipe(
          RxJS.tap({
            error: err => this._logger.error(`findById SocialAirdropRule failed, Id: ${airdropRuleDto.id}`, err)
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
                RxJS.filter(airdropRuleFindResult => !!airdropRuleFindResult),
                RxJS.map(airdropRuleFindResult => [socialAirdropRuleDto, airdropRuleFindResult])
              )
            )
          ),
        )),
      RxJS.map(([socialAirdropRuleDto, socialAirdropRuleEntity]) => {
        socialAirdropRuleEntity.unit = socialAirdropRuleDto.unit ? socialAirdropRuleDto.unit : socialAirdropRuleEntity.unit;
        socialAirdropRuleEntity.amount = socialAirdropRuleDto.amount ? socialAirdropRuleDto.amount : socialAirdropRuleEntity.amount;
        socialAirdropRuleEntity.decimal = socialAirdropRuleDto.decimal ? socialAirdropRuleDto.decimal : socialAirdropRuleEntity.decimal;
        return socialAirdropRuleEntity;
      }),
      RxJS.mergeMap((entity:SocialAirdropRuleEntity) =>
        RxJS.from(this._entityManager.getRepository(SocialAirdropRuleEntity).save(entity)).pipe(
          RxJS.tap({
            next: result => this._logger.debug(`update SocialAirdropRule success, id: ${result.id}, actionType: ${result.actionType}, socialType: ${result.socialType}`),
            error: err => this._logger.error(`update SocialAirdropRule failed, actionType ${entity.actionType}, socialType: ${entity.socialType}`, err)
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
