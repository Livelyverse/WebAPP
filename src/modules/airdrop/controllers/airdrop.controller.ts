import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Param, Query, UseGuards } from "@nestjs/common";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { AirdropFilterType, AirdropInfoViewDto } from "../domain/dto/airdropInfoView.dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortTypePipe } from "../domain/pipe/sortTypePipe";
import { FindAllType, SortBy, SortType } from "../services/IAirdrop.service";
import { SortByPipe } from "../domain/pipe/sortByPipe";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { AirdropBalanceViewDto } from "../domain/dto/airdropBalanceView.dto";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { SocialActionType } from "../domain/entity/enums";
import { AirdropService, FindAllBalanceType } from "../services/airdrop.service";
import { isUUID } from "class-validator";
import { SocialAirdropEntity } from "../domain/entity/socialAirdrop.entity";
import { FindAllBalanceViewDto } from "../domain/dto/findAllBalanceView.dto";


@ApiBearerAuth()
@ApiTags('/api/lively/airdrop/reports')
@Controller('/api/lively/airdrop/reports')
export class AirdropController {

  private readonly _logger = new Logger(AirdropController.name);
  constructor(private readonly _airdropService: AirdropService) {}

  @Get('/find/info/userid/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: `user id`,
    schema: { type: 'uuid' },
  })
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
    description: 'data sort field can be one of the timestamp fields',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindByUserId(@Param() params,
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new SortTypePipe()) sortType: SortType,
    @Query('sortBy', new SortByPipe(SortBy)) sortBy: SortBy,
  ): RxJS.Observable<FindAllViewDto<AirdropInfoViewDto>> {
    const filterBy = AirdropFilterType.USER_ID;
    return RxJS.merge(
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isUUID(pathParam.param)),
        RxJS.mergeMap(pathParam => this._airdropService.findAll(
          (page - 1) * offset, offset, sortType, sortBy, filterBy, pathParam.param)),
        RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialLively Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total >= 0),
              RxJS.map(findAllResult =>
                FindAllViewDto.from(page, offset, findAllResult.total,
                  Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto> ,
              ),
            )
          )
        ),
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => !isUUID(pathParam.param)),
        RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
          statusCode: '400',
          message: 'Invalid Path Param',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST)))
      )
    ).pipe(
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

  @Get('/find/balance/userid/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: `user id`,
    schema: { type: 'uuid' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: AirdropBalanceViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropBalanceByUserId(@Param() params): RxJS.Observable<AirdropBalanceViewDto> {
    const filterBy = AirdropFilterType.USER_ID;
    return RxJS.merge(
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isUUID(pathParam.param)),
        RxJS.mergeMap(pathParam => this._airdropService.findAllBalance(
          null, null, null, null, filterBy, pathParam.param)),
        RxJS.mergeMap((result: FindAllBalanceType) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialLively Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 1),
              RxJS.map(findAllResult => AirdropBalanceViewDto.from(findAllResult.data[0])),
            )
          )
        ),
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => !isUUID(pathParam.param)),
        RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
          statusCode: '400',
          message: 'Invalid Path Param',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST)))
      )
    ).pipe(
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

  @Get('/find/all/info/')
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
    description: 'data sort type can be one of ASC or DESC',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'data sort field can be one of the timestamp fields',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by one of ${Object.values(AirdropFilterType)}`,
    schema: { enum: Object.values(AirdropFilterType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter by one of uuid or ${Object.values(SocialType)} or ${Object.values(SocialActionType)}`,
    schema: {
      oneOf: [
        { enum: Object.values(SocialType) },
        { enum: Object.values(SocialActionType)},
        { type: 'uuid' }
      ]
    },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new SortTypePipe()) sortType: SortType,
    @Query('sortBy', new SortByPipe(SortBy)) sortBy: SortBy,
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
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal)),
              RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialLively Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total >= 0),
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
                message: 'Invalid Path Param',
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
              (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialType)),
            RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
              RxJS.merge(
                RxJS.of(result).pipe(
                  RxJS.filter((findAllResult) => findAllResult.total === 0),
                  RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                      statusCode: '404',
                      message: 'SocialLively Not Found',
                      error: 'Not Found'
                    }, HttpStatus.NOT_FOUND))
                  )
                ),
                RxJS.of(result).pipe(
                  RxJS.filter((findAllResult) => findAllResult.total >= 0),
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
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialActionType)),
              RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialLively Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total >= 0),
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
        RxJS.filter(filterType => !!!filterType),
        RxJS.mergeMap(_ => this._airdropService.findAll(
          (page - 1) * offset, offset, sortType, sortBy, null, null)),
        RxJS.mergeMap((result: FindAllType<SocialAirdropEntity>) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialLively Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total >= 0),
              RxJS.map(findAllResult =>
                FindAllViewDto.from(page, offset, findAllResult.total,
                  Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropInfoViewDto>,
              ),
            )
          )
        ),
      )
    ).pipe(
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

  @Get('/find/all/balance')
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
    description: 'data sort type can be one of ASC or DESC',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'data sort field can be one of the timestamp fields',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by one of ${Object.values(AirdropFilterType)}`,
    schema: { enum: Object.values(AirdropFilterType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter by one of uuid or ${Object.values(SocialType)} or ${Object.values(SocialActionType)}`,
    schema: {
      oneOf: [
        { enum: Object.values(SocialType) },
        { enum: Object.values(SocialActionType) },
        { type: 'uuid' }
      ]
    }
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllBalanceViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropFindAllBalance(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new SortTypePipe()) sortType: SortType,
    @Query('sortBy', new SortByPipe(SortBy)) sortBy: SortBy,
    @Query('filterBy', new EnumPipe(AirdropFilterType)) filterBy: AirdropFilterType,
    @Query('filter') filter: string
  ): RxJS.Observable<FindAllBalanceViewDto> {
    return RxJS.merge(
      RxJS.of(filterBy).pipe(
        RxJS.filter(filterType => filterType === AirdropFilterType.USER_ID),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => isUUID(filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialLively Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total >= 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data) ,
                    ),
                  )
                )
              ),
            ),
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => !isUUID(filterVal)),
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
        RxJS.filter(filterType => filterType === AirdropFilterType.SOCIAL_TYPE),
        RxJS.mergeMap(_ =>
          RxJS.merge(
            RxJS.of(filter).pipe(
              RxJS.filter(filterVal => Object.hasOwn(SocialType, filterVal)),
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialType)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialLively Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total >= 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
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
              RxJS.mergeMap(filterVal => this._airdropService.findAllBalance(
                (page - 1) * offset, offset, sortType, sortBy, filterBy, filterVal as SocialActionType)),
              RxJS.mergeMap((result: FindAllBalanceType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'SocialLively Not Found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total >= 0),
                    RxJS.map(findAllResult =>
                      FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                        Math.ceil(findAllResult.total / offset), findAllResult.data),
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
        RxJS.filter(filterType => !!!filterType),
        RxJS.mergeMap(_ => this._airdropService.findAllBalance(
          (page - 1) * offset, offset, sortType, sortBy, null, null)),
        RxJS.mergeMap((result: FindAllBalanceType) =>
          RxJS.merge(
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total === 0),
              RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                  statusCode: '404',
                  message: 'SocialLively Not Found',
                  error: 'Not Found'
                }, HttpStatus.NOT_FOUND))
              )
            ),
            RxJS.of(result).pipe(
              RxJS.filter((findAllResult) => findAllResult.total >= 0),
              RxJS.map(findAllResult =>
                FindAllBalanceViewDto.from(page, offset, findAllResult.total,
                  Math.ceil(findAllResult.total / offset), findAllResult.data),
              ),
            )
          )
        ),
      )
    ).pipe(
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
}