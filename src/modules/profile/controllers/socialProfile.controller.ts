import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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
  Req,
  UseGuards,
  UsePipes, ValidationPipe
} from "@nestjs/common";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { SocialProfileService, SocialProfileSortBy } from "../services/socialProfile.service";
import { SocialProfileCreateDto, SocialProfileUpdateDto, SocialProfileViewDto } from "../domain/dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SocialProfileEntity } from "../domain/entity";
import { SocialType } from "../domain/entity/socialProfile.entity";
import { FindAllType, SortType } from "../services/IService";
import { EnumPipe } from "../domain/pipe/enumPipe";

@ApiBearerAuth()
@ApiTags('/api/profiles/socials')
@Controller('/api/profiles/socials')
export class SocialProfileController {

  private readonly _logger = new Logger(SocialProfileController.name);
  constructor(private readonly _socialProfileService: SocialProfileService) {}

  @Post('create')
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Created Successfully.',
    type: SocialProfileViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileCreate(@Req() req, @Body() socialProfileDto: SocialProfileCreateDto): RxJS.Observable<SocialProfileViewDto> {
    return RxJS.from(this._socialProfileService.create(req.user, socialProfileDto)).pipe(
      RxJS.map(entity => SocialProfileViewDto.from(entity)),
      // RxJS.tap({
      //   error: err => this._logger.error(`socialProfileCreate failed, dto: ${JSON.stringify(socialProfileDto)}`, err)
      // }),
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
    type: SocialProfileViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileUpdate(@Req() req, @Body() socialProfileDto: SocialProfileUpdateDto): RxJS.Observable<SocialProfileViewDto> {
    return RxJS.from(this._socialProfileService.update(socialProfileDto, req.user)).pipe(
      RxJS.map(entity => SocialProfileViewDto.from(entity)),
      RxJS.tap({
        error: err => this._logger.error(`socialProfileUpdate failed, dto: ${JSON.stringify(socialProfileDto)}, user id: ${req.user.id}`, err)
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
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: `data sort field can be one of ${Object.keys(SocialProfileSortBy)}`,
    schema: { enum: Object.keys(SocialProfileSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: `filter by ${Object.keys(SocialType)} `,
    schema: { enum: Object.keys(SocialType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(SocialProfileSortBy)) sortBy: SocialProfileSortBy,
    @Query('filterBy', new EnumPipe(SocialType)) filterBy: SocialType,
  ): RxJS.Observable<FindAllViewDto> {
    return RxJS.from(this._socialProfileService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.DESC,
      sortBy ? sortBy : SocialProfileSortBy.TIMESTAMP,
      filterBy)).pipe(
      RxJS.mergeMap((result: FindAllType<SocialProfileEntity>) =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total === 0),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '404',
                message: 'SocialProfile Not Found',
                error: 'Not Found'
              }, HttpStatus.NOT_FOUND))
            )
          ),
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total > 0),
            RxJS.map(findAllResult =>
              FindAllViewDto.from(page, offset, findAllResult.total,
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto,
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
        error: err => this._logger.error(`socialProfileFindAll failed, filterBy: ${filterBy}`, err)
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

  @Get('/find')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialProfileViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileFindByUserId(@Req() req): RxJS.Observable<SocialProfileViewDto[]> {
    return RxJS.from(this._socialProfileService.find({
      where: { user: { id: req.user.id } }
    })).pipe(
      RxJS.concatMap(entities =>
        RxJS.from(entities).pipe(
          RxJS.map(entity => SocialProfileViewDto.from(entity)),
          RxJS.reduce( (acc,dto) => [...acc, dto], [])
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`socialProfileFindByUserId failed, user: ${req.user.id}`, err)
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
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'find by social profile Id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialProfileViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileFindById(@Req() req, @Param('uuid', new ParseUUIDPipe()) uuid): RxJS.Observable<SocialProfileViewDto> {
    return RxJS.from(this._socialProfileService.findById(uuid)).pipe(
      RxJS.mergeMap(socialFind =>
        RxJS.merge(
          RxJS.of(socialFind).pipe(
            RxJS.filter(socialProfile => socialProfile.user.id === req.user.id),
            RxJS.map(socialProfile => SocialProfileViewDto.from(socialProfile)),
          ),
          RxJS.of(socialFind).pipe(
            RxJS.filter(socialProfile => socialProfile.user.id !== req.user.id),
            RxJS.mergeMap(_ =>
              RxJS.throwError(() => new HttpException(
                {
                  statusCode: '403',
                  message: 'Update Forbidden',
                  error: 'FORBIDDEN'
                }, HttpStatus.FORBIDDEN)
              )
            )
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`socialProfileFindById failed, id: ${uuid}`, err)
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
  @ApiResponse({ status: 200, description: 'Record Found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  socialProfileFindTotalCount(): RxJS.Observable<object> {
    return this._socialProfileService.findTotal().pipe(
      RxJS.map(total => ({total})),
      RxJS.tap({
        error: err => this._logger.error(`socialProfileFindTotalCount failed`, err)
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
}