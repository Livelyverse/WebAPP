import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Query, UseGuards } from "@nestjs/common";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import * as RxJS from "rxjs";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortTypePipe } from "../domain/pipe/sortTypePipe";
import { FindAllType, SortBy, SortType } from "../services/IAirdrop.service";
import { SortByPipe } from "../domain/pipe/sortByPipe";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";
import { FollowerService } from "../services/follower.service";
import { FollowerViewDto } from "../domain/dto/followerView.dto";
import { SocialFollowerEntity } from "../domain/entity/socialFollower.entity";

@ApiBearerAuth()
@ApiTags('/api/lively/social/follower')
@Controller('/api/lively/social/follower')
export class FollowerController {

  private readonly _logger = new Logger(FollowerController.name);
  constructor(private readonly _followerService: FollowerService) {}

  @Get('/find/all/')
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
    name: 'filter',
    required: false,
    description: `filter ${Object.values(SocialType)} `,
    schema: { enum: Object.values(SocialType) },
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
      )
    )
  }
}