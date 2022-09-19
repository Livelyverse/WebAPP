import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes
} from "@nestjs/common";
import { SocialLivelyService } from "../services/socialLively.service";
import * as RxJS from "rxjs";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import { SocialLivelyCreateDto } from "../domain/dto/socialLivelyCreate.dto";
import { SocialLivelyUpdateDto } from "../domain/dto/socialLivelyUpdate.dto";
import { SocialLivelyViewDto } from "../domain/dto/socialLivelyView.dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { FindAllType, SortBy, SortType } from "../services/IAirdropService";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortTypePipe } from "../domain/pipe/sortTypePipe";
import { SortByPipe } from "../domain/pipe/sortByPipe";
import { SocialLivelyEntity } from "../domain/entity/socialLively.entity";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { isEnum, isUUID } from "class-validator";
import { ContextType, ValidationPipe } from "../domain/pipe/validationPipe";

@ApiBearerAuth()
@ApiTags('/api/lively/social/profile')
@Controller('/api/lively/social/profile')
export class SocialLivelyController {

  private readonly _logger = new Logger(SocialLivelyController.name);
  constructor(private readonly _socialLivelyService: SocialLivelyService) {}

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
    description: 'The record has been created successfully.',
    type: SocialLivelyViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  create(@Body() socialLivelyDto: SocialLivelyCreateDto): RxJS.Observable<SocialLivelyViewDto> {
    return RxJS.from(this._socialLivelyService.create(socialLivelyDto)).pipe(
      RxJS.map(entity => SocialLivelyViewDto.from(entity)),
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
    description: 'The record has been updated successfully.',
    type: SocialLivelyViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  update(@Body() socialLivelyDto: SocialLivelyUpdateDto): RxJS.Observable<SocialLivelyViewDto> {

    return RxJS.from(this._socialLivelyService.update(socialLivelyDto)).pipe(
      RxJS.map(entity => SocialLivelyViewDto.from(entity)),
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

  @Get('findAll')
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
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new SortTypePipe()) sortType: SortType,
    @Query('sortBy', new SortByPipe(SortBy)) sortBy: SortBy,
  ): RxJS.Observable<FindAllViewDto<SocialLivelyViewDto>> {
    return RxJS.from(this._socialLivelyService.findAll((page - 1) * offset, offset, sortType, sortBy)).pipe(
      RxJS.mergeMap((result: FindAllType<SocialLivelyEntity>) =>
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
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<SocialLivelyViewDto> ,
            ),
            RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
              {
                statusCode: '500',
                message: 'Internal Server Error',
                error: 'Internal Server Error'
              }, HttpStatus.INTERNAL_SERVER_ERROR))
            )
          )
        )
      )
    )
  }

  @Get('/find/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: `either an uuid or one of the ${Object.values(SocialType)}`,
    schema: { oneOf: [{ enum: Object.values(SocialType) }, { type: 'uuid' }] },
  })
  @ApiResponse({ status: 200, description: 'The record is found.', type: SocialLivelyViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findSocialLively(@Param() params): RxJS.Observable<SocialLivelyViewDto> {
    return RxJS.merge(
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isUUID(pathParam.param)),
        RxJS.mergeMap(pathParam => this._socialLivelyService.findById(pathParam.param)),
        RxJS.map(entity => SocialLivelyViewDto.from(entity)),
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isEnum(pathParam.param, SocialType)),
        RxJS.mergeMap(pathParam => this._socialLivelyService.findOne( { socialType: pathParam.param } )),
        RxJS.map(entity => SocialLivelyViewDto.from(entity)),
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => !isUUID(pathParam.param) && !isEnum(pathParam.param, SocialType)),
        RxJS.mergeMap(pathParam => RxJS.throwError(() => new HttpException({
          statusCode: '400',
          message: 'Invalid Path Param',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST)))
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
    )
  }

  @Get('/total')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Record Found.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findTotalCount(): RxJS.Observable<object> {
    return this._socialLivelyService.findTotal().pipe(
      RxJS.map(total => ({total}))
    )
  }
}
