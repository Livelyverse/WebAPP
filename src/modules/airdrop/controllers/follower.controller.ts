import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Query, UseGuards } from "@nestjs/common";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { FindAllType, SortType } from "../services/IAirdrop.service";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { FollowerService, FollowerSortBy } from "../services/follower.service";
import { FollowerViewDto } from "../domain/dto/followerView.dto";
import { SocialFollowerEntity } from "../domain/entity/socialFollower.entity";

@ApiBearerAuth()
@ApiTags('/api/airdrops/lively/socials/followers')
@Controller('/api/airdrops/lively/socials/followers')
export class FollowerController {

  private readonly _logger = new Logger(FollowerController.name);
  constructor(private readonly _followerService: FollowerService) {}

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
    description: `data sort field can be one of ${Object.keys(FollowerSortBy)}`,
    schema: { enum: Object.keys(FollowerSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: `filter ${Object.keys(SocialType)} `,
    schema: { enum: Object.keys(SocialType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  followerFindAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(FollowerSortBy)) sortBy: FollowerSortBy,
    @Query('filter', new EnumPipe(SocialType)) filter: SocialType
  ): RxJS.Observable<FindAllViewDto<FollowerViewDto>> {
    return RxJS.from(this._followerService.findAll(
        (page - 1) * offset, offset, sortType, sortBy, filter)).pipe(
      RxJS.mergeMap((result: FindAllType<SocialFollowerEntity>) =>
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
            RxJS.filter((findAllResult) => findAllResult.total > 0),
            RxJS.map(findAllResult =>
              FindAllViewDto.from(page, offset, findAllResult.total,
                Math.ceil(findAllResult.total / offset), findAllResult.data) as FindAllViewDto<FollowerViewDto> ,
            ),
          )
        )
      ),
      RxJS.tap({
        error: err => this._logger.error(`followerFindAll failed, filter: ${filter}, sortBy: ${FollowerSortBy}`, err)
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