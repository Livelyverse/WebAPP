import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
  ParseUUIDPipe
} from "@nestjs/common";
import { BlockchainService, BlockchainSortBy, FindAllType, NetworkType } from "./blockchain.service";
import { FindAllTxViewDto } from "./domain/dto/findAllTxView.dto";
import { SortType, SortTypePipe } from "./domain/pipe/sortTypePipe";
import { ApiQuery, ApiResponse, ApiTags, getSchemaPath } from "@nestjs/swagger";
import { SortByPipe } from "./domain/pipe/sortByPipe";
import * as RxJS from "rxjs";
import { PaginationPipe } from "./domain/pipe/paginationPipe";
import { BlockchainTxViewDto } from "./domain/dto/blockchainTxView.dto";
import { TxStatus } from "./domain/entity/blockchainTx.entity";
import { TxHashPipe } from "./domain/pipe/txHashPipe";
import { AddressPipe } from "./domain/pipe/addressPipe";
import { EnumPipe } from "./domain/pipe/enumPipe";

@ApiTags('/api/blockchain')
@Controller('/api/blockchain')
export class BlockchainController {
  private readonly _logger = new Logger(BlockchainController.name);
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('/findAll')
  @HttpCode(HttpStatus.OK)
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
    description:
      'data sort field can be one of the timestamp or the block_number fields',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'The record is found.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  findAll(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new SortTypePipe()) sortType: SortType,
    @Query('sortBy', new SortByPipe(BlockchainSortBy)) sortBy: BlockchainSortBy,
  ): RxJS.Observable<FindAllTxViewDto> {
    return RxJS.from(this.blockchainService.findAll((page - 1) * offset, offset, sortType, sortBy)).pipe(
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
      )
    )
  }

  @Get('/find')
  @HttpCode(HttpStatus.OK)
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
    schema: { enum: Object.values(NetworkType) },
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
  @ApiResponse({ status: 200, description: 'The record is found.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
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
            RxJS.from(this.blockchainService.findByFilter(filter)).pipe(
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
    )
  }
}
