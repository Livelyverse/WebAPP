import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger, Param,
  Post, Query,
  UseGuards,
  UsePipes
} from "@nestjs/common";
import { ContextType, ValidationPipe } from "../../airdrop/domain/pipe/validationPipe";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { isEnum, isUUID } from "class-validator";
import { FindAllType, SocialProfileService, SortBy, SortType } from "../services/socialProfile.service";
import { SocialProfileCreateDto, SocialProfileUpdateDto, SocialProfileViewDto } from "../domain/dto";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortTypePipe } from "../domain/pipe/sortTypePipe";
import { SortByPipe } from "../domain/pipe/sortByPipe";
import { SocialProfileEntity } from "../domain/entity";
import { SocialType } from "../domain/entity/socialProfile.entity";
import { EnumPipe } from "../../blockchain/domain/pipe/enumPipe";
import { TxStatus } from "../../blockchain/domain/entity/blockchainTx.entity";

@ApiBearerAuth()
@ApiTags('/api/profile/user/social')
@Controller('/api/profile/user/social')
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
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Record Created Successfully.',
    type: SocialProfileViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  create(@Body() socialProfileDto: SocialProfileCreateDto): RxJS.Observable<SocialProfileViewDto> {
    return RxJS.from(this._socialProfileService.create(socialProfileDto)).pipe(
      RxJS.map(entity => SocialProfileViewDto.from(entity)),
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  update(@Body() socialProfileDto: SocialProfileUpdateDto): RxJS.Observable<SocialProfileViewDto> {

    return RxJS.from(this._socialProfileService.update(socialProfileDto)).pipe(
      RxJS.map(entity => SocialProfileViewDto.from(entity)),
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
  @ApiQuery({
    name: 'filterBy',
    required: false,
    description: 'filterBy can be socialType field',
    schema: { enum: Object.values(SocialType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto })
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
    @Query('filterBy', new EnumPipe(SocialType)) filterBy: SocialType,
  ): RxJS.Observable<FindAllViewDto> {
    return RxJS.from(this._socialProfileService.findAll((page - 1) * offset, offset, sortType, sortBy, filterBy)).pipe(
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
            RxJS.filter((findAllResult) => findAllResult.total >= 0),
            RxJS.map(findAllResult =>
              FindAllViewDto.from(page, offset, findAllResult.total,
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto,
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

  @Get('/findByUser/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'user Id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialProfileViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findByUserId(@Param() params): RxJS.Observable<SocialProfileViewDto[]> {
    return RxJS.merge(
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isUUID(pathParam.userId)),
        RxJS.mergeMap(pathParam => this._socialProfileService.find({
          user: { id: pathParam.userId }
        })),
        RxJS.switchMap(entities =>
          RxJS.from(entities).pipe(
            RxJS.map(entity => SocialProfileViewDto.from(entity)),
            RxJS.reduce( (acc,dto) => [...acc, dto], [])
          )
        ),
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => !isUUID(pathParam.userId)),
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

  @Get('/findById/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'id',
    required: true,
    description: 'social profile Id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: SocialProfileViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findById(@Param() params): RxJS.Observable<SocialProfileViewDto> {
    return RxJS.merge(
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => isUUID(pathParam.id, "all")),
        RxJS.mergeMap(pathParam => this._socialProfileService.findById(pathParam.id)),
        RxJS.map(entity => SocialProfileViewDto.from(entity))
      ),
      RxJS.of(params).pipe(
        RxJS.filter(pathParam => !isUUID(pathParam.id, "all")),
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
  @ApiResponse({ status: 200, description: 'Record Found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findTotalCount(): RxJS.Observable<object> {
    return this._socialProfileService.findTotal().pipe(
      RxJS.map(total => ({total}))
    )
  }
}