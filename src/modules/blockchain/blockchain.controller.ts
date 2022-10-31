import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger, Query, UseGuards } from "@nestjs/common";
import { BlockchainService, BlockchainSortBy, FindAllType, NetworkType, SortType } from "./blockchain.service";
import { FindAllTxViewDto } from "./domain/dto/findAllTxView.dto";
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import * as RxJS from "rxjs";
import { PaginationPipe } from "./domain/pipe/paginationPipe";
import { BlockchainTxViewDto } from "./domain/dto/blockchainTxView.dto";
import { TxStatus } from "./domain/entity/blockchainTx.entity";
import { TxHashPipe } from "./domain/pipe/txHashPipe";
import { AddressPipe } from "./domain/pipe/addressPipe";
import { EnumPipe } from "./domain/pipe/enumPipe";
import { JwtAuthGuard } from "../authentication/domain/gurad/jwt-auth.guard";
import { SocialProfileSortBy } from "../profile/services/socialProfile.service";

@ApiBearerAuth()
@ApiTags('/api/blockchains')
@Controller('/api/blockchains')
export class BlockchainController {
  private readonly _logger = new Logger(BlockchainController.name);
  constructor(private readonly _blockchainService: BlockchainService) {}

  @Get('/find/all')
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
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllTxViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(BlockchainSortBy)) sortBy: BlockchainSortBy,
  ): RxJS.Observable<FindAllTxViewDto> {
    return RxJS.from(this._blockchainService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : BlockchainSortBy.TIMESTAMP
    )).pipe(
      RxJS.mergeMap((result:FindAllType) =>
        RxJS.merge(
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total === 0),
            RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                statusCode: '404',
                message: 'blockchain tx not found',
                error: 'Not Found'
              }, HttpStatus.NOT_FOUND))
            )
          ),
          RxJS.of(result).pipe(
            RxJS.filter((findAllResult) => findAllResult.total >= 0),
            RxJS.map(findAllResult =>
              FindAllTxViewDto.from(page, offset, findAllResult.total,
                Math.ceil(findAllResult.total / offset), findAllResult.data),
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

  @Get('/find')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'txHash',
    required: false,
    description: 'transaction hash',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'network',
    required: false,
    description: 'blockchain network name',
    schema: { enum: Object.keys(NetworkType) },
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'transaction from address',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'transaction to address',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'transaction status',
    schema: { enum: Object.keys(TxStatus) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: BlockchainTxViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findByFilter(
    @Query('txHash', new TxHashPipe()) txHash: string,
    @Query('network', new EnumPipe(NetworkType)) network: NetworkType,
    @Query('from', new AddressPipe()) from: string,
    @Query('to', new AddressPipe()) to: string,
    @Query('status', new EnumPipe(TxStatus)) status: TxStatus,
  ): RxJS.Observable<BlockchainTxViewDto[]> {
    return RxJS.defer(() =>
      RxJS.merge(
        RxJS.of({txHash, from, to, network, status}).pipe(
          RxJS.filter(filter => !filter.txHash && !filter.from && !filter.to && !filter.network && !filter.status),
          RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
            statusCode: '400',
            message: 'query params are empty',
            error: 'Bad Request'
          }, HttpStatus.BAD_REQUEST)))
        ),
        RxJS.of({txHash, from, to, network, status}).pipe(
          RxJS.filter(filter => !!filter.txHash || !!filter.from || !!filter.to || !!filter.network || !!filter.status),
          RxJS.mergeMap(filter =>
            RxJS.from(this._blockchainService.findByFilter(filter)).pipe(
              RxJS.mergeMap((result:FindAllType) =>
                RxJS.merge(
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total === 0),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new HttpException({
                        statusCode: '404',
                        message: 'blockchain tx not found',
                        error: 'Not Found'
                      }, HttpStatus.NOT_FOUND))
                    )
                  ),
                  RxJS.of(result).pipe(
                    RxJS.filter((findAllResult) => findAllResult.total > 0),
                    RxJS.mergeMap(findAllResult =>
                      RxJS.from(findAllResult.data).pipe(
                        RxJS.map(blockchainTx => BlockchainTxViewDto.from(blockchainTx)),
                        RxJS.toArray()
                      )
                    )
                  )
                )
              )
            )
          )
        )
      ),
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
