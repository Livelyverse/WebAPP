import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes, ValidationPipe
} from "@nestjs/common";
import * as RxJS from "rxjs";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { FindAllType, SortType } from "../services/IAirdrop.service";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { AirdropScheduleService, AirdropScheduleSortBy } from "../services/airdropSchedule.service";
import { AirdropScheduleCreateDto } from "../domain/dto/airdropScheduleCreate.dto";
import { AirdropScheduleViewDto } from "../domain/dto/airdropSheduleView.dto";
import { AirdropScheduleUpdateDto } from "../domain/dto/airdropScheduleUpdate.dto";
import { SocialAirdropScheduleEntity } from "../domain/entity/socialAirdropSchedule.entity";


@ApiBearerAuth()
@ApiTags('/api/airdrops/socials/schedules')
@Controller('/api/airdrops/socials/schedules')
export class AirdropScheduleController {

  private readonly _logger = new Logger(AirdropScheduleController.name);
  constructor(private readonly _airdropScheduleService: AirdropScheduleService) {}

  @Post('create')
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Created Successfully.',
    type: AirdropScheduleViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropScheduleCreate(@Body() airdropScheduleDto: AirdropScheduleCreateDto): RxJS.Observable<AirdropScheduleViewDto> {
    return RxJS.from(this._airdropScheduleService.create(airdropScheduleDto)).pipe(
      RxJS.map(entity => AirdropScheduleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropScheduleCreate failed, dto: ${JSON.stringify(airdropScheduleDto)}`, err)
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

  @Post('update')
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Updated Successfully.',
    type: AirdropScheduleViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropScheduleUpdate(@Body() airdropScheduleDto: AirdropScheduleUpdateDto): RxJS.Observable<AirdropScheduleViewDto> {

    return RxJS.from(this._airdropScheduleService.update(airdropScheduleDto)).pipe(
      RxJS.map(entity => AirdropScheduleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropScheduleUpdate failed, dto: ${JSON.stringify(airdropScheduleDto)}`, err)
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
    description: `data sort field can be one of ${Object.keys(AirdropScheduleSortBy)}`,
    schema: { enum: Object.keys(AirdropScheduleSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropScheduleFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(AirdropScheduleSortBy)) sortBy: AirdropScheduleSortBy,
  ): RxJS.Observable<FindAllViewDto<AirdropScheduleViewDto>> {
    return RxJS.from(this._airdropScheduleService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : AirdropScheduleSortBy.TIMESTAMP
    )).pipe(
      RxJS.mergeMap((result: FindAllType<SocialAirdropScheduleEntity>) =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total === 0),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '404',
                message: 'Social Airdrop Schedule Not Found',
                error: 'Not Found'
              }, HttpStatus.NOT_FOUND))
            )
          ),
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total >= 0),
            RxJS.map(findAllResult =>
              FindAllViewDto.from(page, offset, findAllResult.total,
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropScheduleViewDto> ,
            ),
            RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
              {
                statusCode: '500',
                message: 'Something Went Wrong',
                error: 'Internal Server Error'
              }, HttpStatus.INTERNAL_SERVER_ERROR))
            )
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`socialLivelyFindAll failed, sortBy: ${sortBy}`, err)
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

  @Get('/find/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: `find social airdrop schedule by id `,
    schema: { type: 'uuid' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: AirdropScheduleViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropScheduleFindById(@Param('uuid', new ParseUUIDPipe()) uuid): RxJS.Observable<AirdropScheduleViewDto> {
    return RxJS.from(this._airdropScheduleService.findById(uuid)).pipe(
      RxJS.map(entity => AirdropScheduleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropScheduleFindById failed, id: ${uuid}`, err)
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

  @Get('/find/total')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Record Found.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropScheduleFindTotalCount(): RxJS.Observable<object> {
    return this._airdropScheduleService.findTotal().pipe(
      RxJS.map(total => ({total})),
      RxJS.tap({
        error: err => this._logger.error(`airdropScheduleFindTotalCount failed`, err)
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
