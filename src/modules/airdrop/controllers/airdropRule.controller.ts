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
  UsePipes
} from "@nestjs/common";
import * as RxJS from "rxjs";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import { SocialLivelyViewDto } from "../domain/dto/socialLivelyView.dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { FindAllType, SortType } from "../services/IAirdrop.service";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { ContextType, ValidationPipe } from "../domain/pipe/validationPipe";
import { AirdropRuleService, AirdropRuleSortBy } from "../services/airdropRule.service";
import { AirdropRuleCreateDto } from "../domain/dto/airdropRuleCreate.dto";
import { AirdropRuleViewDto } from "../domain/dto/airdropRuleView.dto";
import { AirdropRuleUpdateDto } from "../domain/dto/airdropRuleUpdate.dto";
import { SocialAirdropRuleEntity } from "../domain/entity/socialAirdropRule.entity";
import { EnumPipe } from "../domain/pipe/enumPipe";

@ApiBearerAuth()
@ApiTags('/api/airdrops/rules/')
@Controller('/api/airdrops/rules/')
export class AirdropRuleController {

  private readonly _logger = new Logger(AirdropRuleController.name);
  constructor(private readonly _airdropRuleService: AirdropRuleService) {}

  @Post('create')
  @UsePipes(new ValidationPipe({
    transform: true,
    validationContext: ContextType.CREATE,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Created Successfully',
    type: AirdropRuleViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropRuleCreate(@Body() airdropRuleDto: AirdropRuleCreateDto): RxJS.Observable<AirdropRuleViewDto> {
    return RxJS.from(this._airdropRuleService.create(airdropRuleDto)).pipe(
      RxJS.map(entity => AirdropRuleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropRuleCreate failed, dto: ${JSON.stringify(airdropRuleDto)}`, err)
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
    validationContext: ContextType.UPDATE,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Updated Successfully.',
    type: AirdropRuleViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropRuleUpdate(@Body() airdropRuleDto: AirdropRuleUpdateDto): RxJS.Observable<AirdropRuleViewDto> {

    return RxJS.from(this._airdropRuleService.update(airdropRuleDto)).pipe(
      RxJS.map(entity => AirdropRuleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropRuleUpdate failed, dto: ${JSON.stringify(airdropRuleDto)}`, err)
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
    description: `data sort field can be one of ${Object.keys(AirdropRuleSortBy)}`,
    schema: { enum: Object.keys(AirdropRuleSortBy) },
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
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropRuleFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(AirdropRuleSortBy)) sortBy: AirdropRuleSortBy,
  ): RxJS.Observable<FindAllViewDto<AirdropRuleViewDto>> {
    return RxJS.from(this._airdropRuleService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : AirdropRuleSortBy.TIMESTAMP
    )).pipe(
      RxJS.mergeMap((result: FindAllType<SocialAirdropRuleEntity>) =>
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
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<AirdropRuleViewDto> ,
            ),
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`airdropRuleFindAll failed, AirdropRuleSortBy: ${sortBy}`, err)
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
    description: `find by airdrop rule id`,
    schema: { type: 'uuid' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialLivelyViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropRulesFindById(@Param('uuid', new ParseUUIDPipe()) uuid): RxJS.Observable<AirdropRuleViewDto> {
    return RxJS.from(this._airdropRuleService.findById(uuid)).pipe(
      RxJS.map(entity => AirdropRuleViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`airdropRulesFindById failed, uuid: ${uuid}`, err)
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

  @Get('/find/social/:social')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'social',
    required: true,
    description: `find by one of ${Object.keys(SocialType)}`,
    schema: { enum: Object.keys(SocialType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialLivelyViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  airdropRulesFindBySocialType(@Param('social', new EnumPipe(SocialType)) social: SocialType):
    RxJS.Observable<AirdropRuleViewDto[]> {
    return RxJS.from(this._airdropRuleService.find( { socialType: social } )).pipe(
      RxJS.map(entities => entities.map(entity =>
        AirdropRuleViewDto.from(entity)).reduce((acc, value) => [...acc, value], [])),
      RxJS.tap({
        error: err => this._logger.error(`airdropRulesFindBySocialType failed, socialType: ${social}`, err)
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
      )
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
  airdropRulesFindTotalCount(): RxJS.Observable<object> {
    return this._airdropRuleService.findTotal().pipe(
      RxJS.map(total => ({total})),
      RxJS.tap({
        error: err => this._logger.error(`airdropRulesFindTotalCount failed`, err)
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
      )
    );
  }
}
