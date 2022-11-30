import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  CACHE_MANAGER,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus, Inject,
  Logger,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { AirdropFilterType, AirdropInfoViewDto } from "../domain/dto/airdropInfoView.dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { BalanceSortBy, FindAllType, SortType } from "../services/IAirdrop.service";
import { AirdropBalanceViewDto } from "../domain/dto/airdropBalanceView.dto";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { SocialActionType } from "../domain/entity/enums";
import {
  AirdropService,
  AirdropSortBy, AirdropUserBalance,
  AirdropViewSortBy,
  FindAllAirdropType,
  FindAllBalanceType
} from "../services/airdrop.service";
import { isUUID } from "class-validator";
import { SocialAirdropEntity } from "../domain/entity/socialAirdrop.entity";
import { FindAllBalanceViewDto } from "../domain/dto/findAllBalanceView.dto";
import { BooleanPipe } from "../domain/pipe/booleanPipe";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { AirdropEventStatus, AirdropUserFilterType } from "../domain/dto/airdropUserView.dto";
import { FindAllAirdropUserViewDto } from "../domain/dto/findAllAirdropUserView.dto";
import { Cache } from "cache-manager";


@ApiBearerAuth()
@ApiTags('/api/airdrops/events')
@Controller('/api/airdrops/events')
export class AirdropController {

  private readonly _logger = new Logger(AirdropController.name);
  constructor(
    private readonly _airdropService: AirdropService,
    @Inject(CACHE_MANAGER)
    private readonly _cacheManager: Cache,
  ) {}

  @Get('/find/user/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'data page',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    description: 'data offset',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: 'data sort type can be one of ASC or DESC',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: `data sort field can be one of ${Object.keys(AirdropViewSortBy)}`,
    schema: { enum: Object.keys(AirdropViewSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'socialType',
    required: false,
    description: `social types ${Object.keys(SocialType)}`,
    schema: { enum: Object.keys(SocialType) },
  })
  @ApiQuery({
    name: 'actionType',
    required: false,
    description: `action types ${Object.keys(SocialActionType)}`,
    schema: { enum: Object.keys(SocialActionType) },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: `status ${Object.keys(AirdropEventStatus)}`,
    schema: { enum: Object.keys(AirdropEventStatus) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindByUserId(@Req() req,
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(AirdropViewSortBy)) sortBy: AirdropViewSortBy,
    @Query('socialType', new EnumPipe(SocialType)) socialType: SocialType,
    @Query('actionType', new EnumPipe(SocialActionType)) socialActionType: SocialActionType,
    @Query('status', new EnumPipe(AirdropEventStatus)) eventStatus: AirdropEventStatus
  ): RxJS.Observable<FindAllAirdropUserViewDto> {
    return RxJS.from(this._cacheManager.get<FindAllAirdropUserViewDto>(`AIRDROP_USER:${req.url}&id=${req.user.id}`)).pipe(
      RxJS.mergeMap(result =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(cacheDto => !!cacheDto),
            RxJS.identity
          ),
          RxJS.of(result).pipe(
            RxJS.filter(cacheDto => !cacheDto),
            RxJS.mergeMap(_ => RxJS.from(
                this._airdropService.findEventByUser(
                  req.user.id,
                  (page - 1) * offset,
                  offset,
                  sortType ? sortType : SortType.ASC,
                  sortBy ? sortBy : AirdropViewSortBy.TIMESTAMP,
                  eventStatus,
                  socialType,
                  socialActionType
                )).pipe(
                RxJS.mergeMap((result: FindAllAirdropType) =>
                  RxJS.merge(
                    RxJS.of(result).pipe(
                      RxJS.filter((findAllResult) => findAllResult.total === 0),
                      RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                          statusCode: '404',
                          message: 'Social Airdrop Not Found',
                          error: 'Not Found'
                        }, HttpStatus.NOT_FOUND))
                      )
                    ),
                    RxJS.of(result).pipe(
                      RxJS.filter((findAllResult) => findAllResult.total > 0),
                      RxJS.map(findAllResult =>
                        FindAllAirdropUserViewDto.from(page, offset, findAllResult.total,
                          Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllAirdropUserViewDto ,
                      ),
                      RxJS.mergeMap(findAllResult =>
                        RxJS.from(
                          this._cacheManager.set(`AIRDROP_USER:${req.url}&id=${req.user.id}`, findAllResult, {ttl: 1000})
                        ).pipe(
                          RxJS.map(_ => findAllResult)
                        )
                      )
                    )
                  )
                ),
              )
            )
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`airdropFindByUserId failed, user.id: ${req.user.id}`, err)
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

  @Get('/find/balance/user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by one of ${Object.keys(AirdropUserFilterType)}`,
    schema: { enum: Object.keys(AirdropUserFilterType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter by one of ${Object.keys(SocialType)} or ${Object.keys(SocialActionType)}`,
    schema: {
      oneOf: [
        { enum: Object.keys(SocialType) },
        { enum: Object.keys(SocialActionType)},
      ]
    },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: AirdropBalanceViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindBalanceByUserId(@Req() req,
     @Query('filterBy', new EnumPipe(AirdropUserFilterType)) filterBy: AirdropUserFilterType,
     @Query('filter') filter: string
  ): RxJS.Observable<AirdropUserBalance> {

    return RxJS.from(this._cacheManager.get<AirdropUserBalance>(`AIRDROP_USER_BALANCE:${req.url}&id=${req.user.id}`)).pipe(
      RxJS.mergeMap(result =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter(cacheDto => !!cacheDto),
            RxJS.identity
          ),
          RxJS.of(result).pipe(
            RxJS.filter(cacheDto => !cacheDto),
            RxJS.mergeMap(_ =>  RxJS.from(
                this._airdropService.findUserBalance(req.user.id, filterBy, filter)).pipe(
                RxJS.mergeMap((result: AirdropUserBalance) =>
                  RxJS.merge(
                    RxJS.of(result).pipe(
                      RxJS.filter((result) => !result),
                      RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                          statusCode: '404',
                          message: 'Social Airdrop User Balance Not Found',
                          error: 'Not Found'
                        }, HttpStatus.NOT_FOUND))
                      )
                    ),
                    RxJS.of(result).pipe(
                      RxJS.filter((result) => !!result),
                      RxJS.mergeMap(balanceResult =>
                        RxJS.from(
                          this._cacheManager.set(`AIRDROP_USER_BALANCE:${req.url}&id=${req.user.id}`, balanceResult, {ttl: 1000})
                        ).pipe(
                          RxJS.map(_ => balanceResult)
                        )
                      ),
                    )
                  )
                ),
              )
            )
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`airdropFindBalanceByUserId failed, user.id: ${req.user.id}`, err)
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


  // TODO refactor it
  @Get('/find/all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'data page',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    description: 'data offset',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: `data sort field can be one of ${Object.keys(AirdropSortBy)}`,
    schema: { enum: Object.keys(AirdropSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'settlement',
    required: false,
    description: 'airdrop tx settlement',
    schema: { type: 'boolean' },
  })
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by one of ${Object.keys(AirdropFilterType)}`,
    schema: { enum: Object.keys(AirdropFilterType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter by one of uuid or ${Object.keys(SocialType)} or ${Object.keys(SocialActionType)}`,
    schema: {
      oneOf: [
        { enum: Object.keys(SocialType) },
        { enum: Object.keys(SocialActionType)},
        { type: 'uuid' }
      ]
    },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(AirdropSortBy)) sortBy: AirdropSortBy,
    @Query('settlement', new BooleanPipe()) isSettlement: boolean,
    @Query('filterBy', new EnumPipe(AirdropFilterType)) filterBy: AirdropFilterType,
    @Query('filter') filter: string
  ): RxJS.Observable<FindAllViewDto<AirdropInfoViewDto>> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.USER_ID),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => isUUID(filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAll(
                (page - 1) * offset,
                offset,
                sortType ? sortType : SortType.ASC,
                sortBy ? sortBy : AirdropSortBy.TIMESTAMP,
                isSettlement,
                filterBy,
                filterVal)),
              RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto> ,
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !isUUID(filterVal)),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '400',
                message: 'Invalid filter Query String',
                error: 'Bad Request'
              }, HttpStatus.BAD_REQUEST)))
            )
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.SOCIAL_TYPE),
        RxJS.mergeMap(_ =>
          RxJS.merge(
          RxJS.of(filter).pipe(
            RxJS.filter(filterVal => Object.hasOwn(SocialType, filterVal)),
            RxJS.mergeMap(filterVal => this._airdropService.findAll(
              (page - 1) * offset,
              offset,
              sortType ? sortType : SortType.ASC,
              sortBy ? sortBy : AirdropSortBy.TIMESTAMP,
              isSettlement,
              filterBy,
              filterVal as SocialType)),
            RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
              RxJS.merge(
                RxJS.of(result).pipe(
                  RxJS.filter((findAllResult) => findAllResult.total === 0),
                  RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                      statusCode: '404',
                      message: 'SocialAirdrop Not Found',
                      error: 'Not Found'
                    }, HttpStatus.NOT_FOUND))
                  )
                ),
                RxJS.of(result).pipe(
                  RxJS.filter((findAllResult) => findAllResult.total > 0),
                  RxJS.map(findAllResult =>
                    FindAllViewDto.from(page, offset, findAllResult.total,
                      Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto> ,
                  ),
                )
              )
            ),
          ),
          RxJS.of(filter).pipe(
            RxJS.filter(filterVal => !Object.hasOwn(SocialType, filterVal)),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
              statusCode: '400',
              message: 'Invalid Path Param',
              error: 'Bad Request'
            }, HttpStatus.BAD_REQUEST)))
          )
        )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.SOCIAL_ACTION),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => Object.hasOwn(SocialActionType, filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAll(
                (page - 1) * offset,
                offset,
                sortType ? sortType : SortType.ASC,
                sortBy ? sortBy : AirdropSortBy.TIMESTAMP,
                isSettlement,
                filterBy,
                filterVal as SocialActionType)),
              RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto> ,
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !Object.hasOwn(SocialActionType, filterVal)),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '400',
                message: 'Invalid Path Param',
                error: 'Bad Request'
              }, HttpStatus.BAD_REQUEST)))
            )
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => !filterType),
        RxJS.mergeMap(_ => this._airdropService.findAll(
          (page - 1) * offset,
          offset,
          sortType ? sortType : SortType.ASC,
          sortBy ? sortBy : AirdropSortBy.TIMESTAMP,
          isSettlement,
          null,
          null)),
        RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialAirdrop Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total > 0),
              RxJS.map(findAllResult =>
                FindAllViewDto.from(page, offset, findAllResult.total,
                  Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto>,
              ),
            )
          )
        ),
      )
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`airdropFindAll failed, filterBy: ${filterBy}, filter: ${filter}`, err)
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

  // TODO refactor it
  @Get('/find/balance/all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'data page',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    description: 'data offset',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: `sortBy field can be one of ${Object.keys(BalanceSortBy)}`,
    schema: { enum: Object.keys(BalanceSortBy) },
  })
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by one of ${Object.keys(AirdropFilterType)}`,
    schema: { enum: Object.keys(AirdropFilterType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter by one of uuid or ${Object.keys(SocialType)} or ${Object.keys(SocialActionType)}`,
    schema: {
      oneOf: [
        { enum: Object.keys(SocialType) },
        { enum: Object.keys(SocialActionType) },
        { type: 'uuid' }
      ]
    }
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllBalanceViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindAllBalance(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(BalanceSortBy)) sortBy: BalanceSortBy,
    @Query('filterBy', new EnumPipe(AirdropFilterType)) filterBy: AirdropFilterType,
    @Query('filter') filter: string
  ): RxJS.Observable<FindAllBalanceViewDto> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.USER_ID),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && isUUID(filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset,
                offset,
                sortType ? sortType : SortType.ASC,
                sortBy ? sortBy : BalanceSortBy.TOTAL,
                filterBy,
                filterVal
              )),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data) ,
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!!filterVal),
              RxJS.mergeMap(_ => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, null)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data) ,
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && !isUUID(filterVal)),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '400',
                message: 'Invalid filter QueryString',
                error: 'Bad Request'
              }, HttpStatus.BAD_REQUEST)))
            )
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.SOCIAL_TYPE),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && Object.hasOwn(SocialType, filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialType)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !!!filterVal),
              RxJS.mergeMap(_ => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, null)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && !Object.hasOwn(SocialType, filterVal)),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '400',
                message: 'Invalid filter QueryString',
                error: 'Bad Request'
              }, HttpStatus.BAD_REQUEST)))
            )
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.SOCIAL_ACTION),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && Object.hasOwn(SocialActionType, filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialActionType)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !filterVal),
              RxJS.mergeMap(_ => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, null)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialAirdrop Balance Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => filterVal && !Object.hasOwn(SocialActionType, filterVal)),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '400',
                message: 'Invalid Filter QueryString',
                error: 'Bad Request'
              }, HttpStatus.BAD_REQUEST)))
            )
          )
        )
      ),
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => !!!filterType),
        RxJS.mergeMap(_ => this._airdropService.findAllBalance(
          (page - 1) * offset, offset, sortType, sortBy, null, null)),
        RxJS.mergeMap((result: FindAllBalanceType) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialAirdrop Balance Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total > 0),
              RxJS.map(findAllResult =>
                FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                  Math.ceil(findAllResult.total / offset), findAllResult.data),
              ),
            )
          )
        ),
      )
    ).pipe(
      RxJS.tap({
        error: err => this._logger.error(`airdropFindAllBalance failed, filterBy: ${filterBy}, filter: ${filter}`, err)
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
}