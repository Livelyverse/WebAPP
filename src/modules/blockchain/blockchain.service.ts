import { HttpException, HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { BigNumber, ContractReceipt, ethers, Wallet } from "ethers";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { AirdropRequestDto, TokenType } from "./domain/dto/airdropRequest.dto";
import { APP_MODE, BLOCK_CHAIN_MODULE_OPTIONS, BlockchainOptions } from "./blockchainConfig";
import { EventEmitter } from "events";
import * as RxJS from "rxjs";
import { AirdropResponseDto } from "./domain/dto/airdropResponse.dto";
import { JsonRpcProvider } from "@ethersproject/providers/src.ts/json-rpc-provider";
import { LivelyToken, LivelyToken__factory } from "@livelyverse/lively-core-onchain/export/types";
import { BlockchainError, ErrorCode } from "./domain/error/blockchainError";
import { IERC20Extra } from "@livelyverse/lively-core-onchain/export/types/token/lively/LivelyToken";
import { ContractTransaction, Event } from "@ethersproject/contracts/src.ts";
import { BlockchainTxEntity, TxStatus, TxType } from "./domain/entity/blockchainTx.entity";
import { TypeORMError } from "typeorm/error/TypeORMError";
import { BlockchainTxViewDto } from "./domain/dto/blockchainTxView.dto";

export interface BlockchainFilterType {
  txHash: string;
  from: string;
  to: string;
  status: TxStatus;
  network: NetworkType;
}

export enum EventType {
  AIRDROP_REQUEST_EVENT = 'AIRDROP_REQUEST',
  AIRDROP_RESPONSE_EVENT = 'AIRDROP_RESPONSE',
  ERROR_EVENT = 'ERROR'
}

export enum BlockchainSortBy {
  TIMESTAMP = 'createdAt',
  BLOCK_NUMBER = 'blockNumber'
}

export enum NetworkType {
  LOCALHOST = 'localhost',
  ETHEREUM = 'ethereum',
  BSC = 'bsc',
  POLYGON = 'polygon',
  GOERLI = 'goerli'
}

export enum SortType {
  ASC = 'ASC',
  DESC = 'DESC'
}

export type FindAllType = {
  data: BlockchainTxEntity[],
  total: number
}

@Injectable()
export class BlockchainService {
  private readonly _logger = new Logger(BlockchainService.name);
  private readonly _systemAdmin: Wallet;
  private readonly _admin: Wallet;
  private readonly _assetManager: Wallet;
  private readonly _taxTreasury: Wallet;
  private readonly _livelyToken: LivelyToken;
  private readonly _jsonRpcProvider: JsonRpcProvider;
  private readonly _eventEmitter: EventEmitter;
  private readonly _airdropSubscription: RxJS.Subscription;
  private readonly _confirmationCount: number;
  private _safeMode: Boolean;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    @Inject(BLOCK_CHAIN_MODULE_OPTIONS)
    private readonly _blockchainOptions: BlockchainOptions,
    private readonly _configService: ConfigService)
  {
    let systemAdmin = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'systemadmin');
    let admin = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'admin');
    let assetManager = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'assetmanager');
    let taxTreasury = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'taxtreasury')
    let livelyToken = this._blockchainOptions.config.tokens.find((token) => token.name.toUpperCase() === 'LVL')
    this._jsonRpcProvider = new ethers.providers.JsonRpcProvider(this._blockchainOptions.config.network.url);
    this._systemAdmin = new ethers.Wallet(systemAdmin.privateKey, this._jsonRpcProvider);
    this._admin = new ethers.Wallet(admin.privateKey, this._jsonRpcProvider);
    this._assetManager = new ethers.Wallet(assetManager.privateKey, this._jsonRpcProvider);
    this._taxTreasury = new ethers.Wallet(taxTreasury.privateKey, this._jsonRpcProvider);
    this._livelyToken = LivelyToken__factory.connect(livelyToken.address, this._admin);
    this._eventEmitter = new EventEmitter();
    this._safeMode = false;
    this._confirmationCount = this._blockchainOptions.appMode == APP_MODE.DEV ? 0 : this._blockchainOptions.appMode == APP_MODE.TEST ? 3 : 7
    this._airdropSubscription = this._airdropInit();
  }

  // private _gasPriceCalculation() {
  //   RxJS.from(this._jsonRpcProvider.getFeeData()).pipe(
  //     RxJS.concatMap((feedData: FeeData) =>
  //       RxJS.merge(
  //         RxJS.of(feedData).pipe(
  //           RxJS.filter((networkFeedData) =>
  //             !!networkFeedData.gasPrice && !!!networkFeedData.maxFeePerGas
  //           ),
  //           RxJS.map(networkFeedData => {
  //             // calculate 15% of current gas price
  //             let extraGasPrice = networkFeedData.gasPrice.div(1500);
  //             return { gasPrice: networkFeedData.gasPrice.add(extraGasPrice), maxFeePerGas: null, maxPriorityFeePerGas: null};
  //           })
  //         ),
  //         RxJS.of(feedData).pipe(
  //           RxJS.filter((networkFeedData) => !!networkFeedData.maxFeePerGas),
  //           // RxJS.map(networkFeedData => { return networkFeedData.maxFeePerGas;})
  //         )
  //       )
  //     ),
  //     RxJS.tap((feedData) => this._logger.log(JSON.stringify(feedData))),
  //     RxJS.catchError((err) =>  {
  //       if (Object.hasOwn(err, 'event') && Object.hasOwn(err, 'code')) {
  //         return RxJS.throwError(() => new BlockchainError("ether js getFeedData failed", err))
  //       }
  //       return RxJS.throwError(err);
  //     }),
  //     RxJS.finalize(() => this._logger.log(`finalize getFeeData()`)),
  //     this.retryWithDelay(30000, 3),
  //   ).subscribe({
  //     next: value => this._logger.log(`gas price: ${JSON.stringify(value)}`),
  //     error: err => this._logger.error(`error: ${err.stack}\n${err?.cause?.stack}`),
  //     complete: () => this._logger.log(`completed`),
  //   })
  // }

  private _airdropInit() {
    return RxJS.defer(() =>
      RxJS.fromEvent(this._eventEmitter, EventType.AIRDROP_REQUEST_EVENT).pipe(
        RxJS.observeOn(RxJS.asyncScheduler),
        RxJS.mergeMap((airdropReq: AirdropRequestDto) =>
          RxJS.merge(
            RxJS.of(airdropReq).pipe(
              RxJS.filter((_) => this._safeMode === true),
              RxJS.tap((request) => this._logger.warn(`airdrop request to blockchain service in safe mode rejected, id: ${request.id.toString()}`)),
              RxJS.mergeMap((request) => {
                this._eventEmitter.emit(EventType.ERROR_EVENT, new BlockchainError('blockchain module safe mode enabled', {code: ErrorCode.SAFE_MODE, id: request.id}))
                return RxJS.EMPTY
              }),
            ),
            RxJS.of(airdropReq).pipe(
              RxJS.filter((_) => !this._safeMode),
              RxJS.identity
            )
          )
        ),
        RxJS.mergeMap((airdropReq: AirdropRequestDto) =>
          RxJS.merge(
            RxJS.of(airdropReq).pipe(
              RxJS.filter(request => request.tokenType !== TokenType.LVL),
              RxJS.tap((request) => this._logger.warn(`airdrop token request not supported, id: ${request.id.toString()}`)),
              RxJS.mergeMap((request) => {
                this._eventEmitter.emit(EventType.ERROR_EVENT, new BlockchainError('Invalid Airdrop Token Request', {code: ErrorCode.INVALID_REQUEST, id: request.id}))
                return RxJS.EMPTY
              })
            ),
            RxJS.of(airdropReq).pipe(
              RxJS.filter(request => request.tokenType === TokenType.LVL),
              RxJS.identity
            )
          )
        ),
        RxJS.concatMap((airdropReq:AirdropRequestDto) =>
          RxJS.from(airdropReq.data).pipe(
            RxJS.map((data) => (<IERC20Extra.BatchTransferRequestStruct>{recipient: data.destination, amount: BigNumber.from(data.amount)})),
            RxJS.toArray(),
            RxJS.map((batchTransfers) => [airdropReq, batchTransfers])
          )
        ),
        RxJS.concatMap(([airdropReq, batchTransfers]) =>
          RxJS.of([airdropReq, batchTransfers]).pipe(
            RxJS.filter((_) => !this._safeMode),
            RxJS.switchMap(([airdropReq, batchTransfers]:[AirdropRequestDto, IERC20Extra.BatchTransferRequestStruct[]]) =>
              RxJS.defer(() => RxJS.from(this._livelyToken.connect(this._assetManager).batchTransfer(batchTransfers))).pipe(
                RxJS.concatMap( (airdropTx: ContractTransaction) =>
                  RxJS.of(airdropTx).pipe(
                    RxJS.map(tx => {
                      let blockchainTx = new BlockchainTxEntity();
                      blockchainTx.txHash = tx.hash;
                      blockchainTx.txType = tx.type === 0 ? TxType.LEGACY : TxType.DEFAULT;
                      blockchainTx.from = tx.from;
                      blockchainTx.to = tx.to;
                      blockchainTx.nonce = tx.nonce;
                      blockchainTx.gasLimit = tx?.gasLimit?.toBigInt();
                      blockchainTx.gasPrice = tx?.gasPrice?.toBigInt() ? tx.gasPrice.toBigInt() : 0n;
                      blockchainTx.maxFeePerGas = tx?.maxFeePerGas?.toBigInt();
                      blockchainTx.maxPriorityFeePerGas = tx?.maxPriorityFeePerGas?.toBigInt();
                      blockchainTx.data = tx.data;
                      blockchainTx.value = tx.value.toBigInt();
                      blockchainTx.networkChainId = this._jsonRpcProvider.network.chainId;
                      blockchainTx.networkName = this._jsonRpcProvider.network.name;
                      blockchainTx.blockNumber = null;
                      blockchainTx.blockHash = null;
                      blockchainTx.gasUsed = null;
                      blockchainTx.effectiveGasPrice = null;
                      blockchainTx.isByzantium = null;
                      blockchainTx.failInfo = null;
                      blockchainTx.status = TxStatus.PENDING;
                      return blockchainTx;
                    }),
                    RxJS.switchMap((blockchainTxEntity: BlockchainTxEntity) =>
                      RxJS.of(blockchainTxEntity).pipe(
                        RxJS.mergeMap((blockchainTx) =>
                          RxJS.from(this._entityManager.createQueryBuilder()
                            .insert()
                            .into(BlockchainTxEntity)
                            .values([blockchainTx])
                            .execute()
                          ).pipe(
                            RxJS.tap({
                              next: (_) => this._logger.log(`save blockchainTxEntity success, id: ${blockchainTx.id}, txHash: ${blockchainTx.txHash}`),
                              error: err => this._logger.error(`save blockchainTxEntity failed, txHash: ${blockchainTx.txHash}\n${err.stack}`)
                            }),
                            RxJS.map((_) => [airdropReq, airdropTx, blockchainTx]),
                          )
                        ),
                        RxJS.catchError((error) =>
                          RxJS.merge(
                            RxJS.of(error).pipe(
                              RxJS.filter(err => err instanceof TypeORMError),
                              RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.SAFE_MODE, id: airdropReq.id})),
                              RxJS.tap({
                                next: (error) => {
                                  this._safeMode = true;
                                  this._logger.warn(`blockchain service safe mode activated . . .`),
                                  this._eventEmitter.emit(EventType.ERROR_EVENT, error)
                                },
                                error: RxJS.noop,
                                complete: RxJS.noop,
                              }),
                            ),
                            RxJS.of(error).pipe(
                              RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
                              RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.NODE_JS_ERROR, id: airdropReq.id})),
                              RxJS.tap((error) => this._eventEmitter.emit(EventType.ERROR_EVENT, error)),
                            ),
                            RxJS.of(error).pipe(
                              RxJS.filter(err => !(err instanceof Error)),
                              RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.UNKNOWN_ERROR, id: airdropReq.id})),
                              RxJS.tap((error) => this._eventEmitter.emit(EventType.ERROR_EVENT, error)),
                            )
                          ).pipe(
                            RxJS.mergeMap( _ => RxJS.of([airdropReq, airdropTx, null]))
                          )
                        ),
                      )
                    )
                  )
                ),
                RxJS.catchError((err) =>
                  RxJS.merge(
                    RxJS.of(err).pipe(
                      // block chain error handling
                      RxJS.filter((error) => error instanceof Error && Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code')),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
                    ),
                    RxJS.of(err).pipe(
                      // general error handling
                      RxJS.filter((error) => error instanceof Error),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`finalize batchTransfer token call . . . `)),
                this.retryWithDelay(30000, 3),
                RxJS.tap({
                  next: (tuple:[AirdropRequestDto, ContractTransaction, BlockchainTxEntity]) => this._logger.log(`send airdrop tx to blockchain success, token: ${tuple[0].tokenType}, txHash: ${tuple[1].hash}`),
                  error: err => this._logger.error(`send airdrop tx to blockchain failed\n${err.stack}\n${err?.cause?.stack}`)
                }),
              )
            ), // send tx to blockchain
            RxJS.mergeMap((tuple:[AirdropRequestDto, ContractTransaction, BlockchainTxEntity]) =>
              RxJS.of(this._confirmationCount).pipe(
                RxJS.switchMap((confirmationCount) =>
                  RxJS.from(tuple[1].wait(confirmationCount)).pipe(
                    RxJS.mergeMap((airdropReceiptTx) =>
                      RxJS.merge(
                        RxJS.of(airdropReceiptTx).pipe(
                          RxJS.filter((_) => !!!tuple[2]),
                          RxJS.tap((airdropReceiptTx) => this._logger.warn(`result airdrop batchTransfer tx but tx doesn't persist, id: ${tuple[0].id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
                          RxJS.mergeMap(_ => RxJS.EMPTY)
                        ),
                        RxJS.of(airdropReceiptTx).pipe(
                          RxJS.filter((_) => !!tuple[2]),
                          RxJS.tap((airdropReceiptTx) => this._logger.log(`airdrop batchTransfer receipt tx, id: ${tuple[0].id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
                          RxJS.mergeMap((airdropReceiptTx) =>
                            RxJS.of(airdropReceiptTx).pipe(
                              RxJS.mergeMap(airdropReceiptTx =>
                                RxJS.merge(
                                  RxJS.of(airdropReceiptTx).pipe(
                                    RxJS.filter(receiptTx => receiptTx.events.length > 0),
                                    RxJS.mergeMap(receiptTx =>
                                      RxJS.from(receiptTx.events).pipe(
                                        RxJS.filter((txEvent: Event) => txEvent.event === 'BatchTransfer' ),
                                        RxJS.take(1),
                                        RxJS.map(event => [event, receiptTx])
                                      )
                                    )
                                  ),
                                  RxJS.of(airdropReceiptTx).pipe(
                                    RxJS.filter(receiptTx => !receiptTx.events.length),
                                    RxJS.mergeMap(_ => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", {code: ErrorCode.INVALID_TX_RECEIPT})))
                                  )
                                )
                              ),
                              RxJS.map(([event, receiptTx]:[Event, ContractReceipt]) => {
                                let blockchainTx = tuple[2];
                                blockchainTx.blockNumber = receiptTx.blockNumber;
                                blockchainTx.blockHash = receiptTx.blockHash;
                                blockchainTx.gasUsed = receiptTx.gasUsed.toBigInt();
                                blockchainTx.effectiveGasPrice = receiptTx.effectiveGasPrice.toBigInt();
                                blockchainTx.isByzantium = receiptTx.byzantium;
                                blockchainTx.failInfo = null;
                                blockchainTx.status = receiptTx.status === 1 ? TxStatus.SUCCESS : TxStatus.FAILED;
                                return [event, blockchainTx];
                              }),
                              // update blockchainTxEntity
                              RxJS.switchMap(([event, blockchainTx]:[Event, BlockchainTxEntity]) =>
                                RxJS.of([event, blockchainTx]).pipe(
                                  RxJS.mergeMap(([event, blockchainTx]) => RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(blockchainTx))),
                                  RxJS.tap({
                                    next: (updateResult) => this._logger.log(`update blockchainTxEntity success, reqId: ${tuple[0].id.toString()}, txHash: ${updateResult.txHash}, status: ${updateResult.status}, blockchainTxId: ${updateResult.id}`),
                                    error: (error) => this._logger.error(`update blockchainTxEntity failed, reqId: ${tuple[0].id.toString()}, txHash: ${blockchainTx.txHash}, blockchainTxId: ${blockchainTx.id}\n${error.stack}`)
                                  }),
                                  RxJS.map(_ => [event, blockchainTx]),
                                  RxJS.catchError((error) =>
                                    RxJS.merge(
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => err instanceof TypeORMError),
                                        RxJS.mergeMap(err => RxJS.of(blockchainTx))
                                      ),
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
                                        RxJS.mergeMap(err => RxJS.throwError(() => new BlockchainError('update blockchainTx failed', {cause: err, code: ErrorCode.NODE_JS_ERROR})))
                                      )
                                    )
                                  )
                                )
                              ),
                            ),
                          ),
                          RxJS.map(([event, blockchainTxEntity]: [Event, BlockchainTxEntity]) => {
                            let response = new AirdropResponseDto();
                            response.id = tuple[0].id;
                            response.recordId = blockchainTxEntity.id;
                            response.tokenType = tuple[0].tokenType;
                            response.txHash = blockchainTxEntity.txHash
                            response.from = blockchainTxEntity.from;
                            response.to = blockchainTxEntity.to;
                            response.nonce = blockchainTxEntity.nonce;
                            response.networkChainId = this._jsonRpcProvider.network.chainId;
                            response.networkName = this._jsonRpcProvider.network.name;
                            response.totalAmount = event.args.totalAmount.toBigInt();
                            response.status = blockchainTxEntity.status;
                            this._eventEmitter.emit(EventType.AIRDROP_RESPONSE_EVENT, response)
                            return response;
                          }),
                          RxJS.tap({
                            next: response => this._logger.log(`airdrop tx token completed, reqId: ${response.id.toString()}, txHash: ${response.txHash}, amount: ${response.totalAmount.toString()}, recordId: ${response.recordId}`),
                            error: err => {
                              this._logger.error(`airdrop tx token failed, txHash: ${airdropReceiptTx.transactionHash}\n${err.stack}\n${err?.cause?.stack}`)
                              this._eventEmitter.emit(EventType.ERROR_EVENT, err)
                            }
                          }),
                          RxJS.catchError((_) => RxJS.EMPTY)
                        )
                      )
                    )
                  )
                ),
                RxJS.catchError((err) =>
                  RxJS.merge(
                    RxJS.of(err).pipe(
                      RxJS.filter((error) => error instanceof Error && Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code')),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", error))),
                    ),
                    RxJS.of(err).pipe(
                      RxJS.filter((error) => !(error instanceof BlockchainError) && error instanceof Error),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", { cause: error, code: ErrorCode.NODE_JS_ERROR }))),
                    ),
                    RxJS.of(err).pipe(
                      RxJS.filter((error) => error instanceof BlockchainError),
                      RxJS.mergeMap((error) => RxJS.throwError(error)),
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`finalize get tx receipt. . . `)),
                this.retryWithDelay(30000, 3),
              )
            ),
          )
        ),
      )
    ).pipe(
      RxJS.tap({
        next: RxJS.noop,
        error: RxJS.noop,
        complete: () => this._logger.debug('airdrop request handler completed, again register airdrop request listener')
      }),
      RxJS.repeat(),
      RxJS.catchError(err =>
         RxJS.merge(
           RxJS.of(err).pipe(
             RxJS.filter((error) => error instanceof BlockchainError),
             RxJS.mergeMap((error) => RxJS.throwError(error)),
           ),
           RxJS.of(err).pipe(
             RxJS.filter((error) => !(error instanceof BlockchainError) && error instanceof Error),
             RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("blockchain airdrop event handler pipeline failed", {cause: error, code: ErrorCode.NODE_JS_ERROR}))),
           ),
           RxJS.of(err).pipe(
             RxJS.filter((error) => !(error instanceof Error)),
             RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("blockchain airdrop event handler pipeline failed", {cause: error, code: ErrorCode.UNKNOWN_ERROR}))),
           )
         ).pipe(
           RxJS.tap({
             next: RxJS.noop,
             error: (err) => this._eventEmitter.emit(EventType.ERROR_EVENT, err),
             complete: RxJS.noop,
           }),
         )
       ),
      RxJS.retry({
         delay: error => RxJS.of(error).pipe(
           RxJS.filter(err => err instanceof BlockchainError),
           RxJS.tap((err) => this._logger.warn(`recreate airdrop pipeline and register again of event handler\n${err.stack}\n${err?.cause?.stack}`)),
           RxJS.identity
         )
       })
    ).subscribe({
      next: RxJS.noop,
      error: err => this._logger.error(`blockchain airdrop pipeline failed, ${err.stack}\n${err?.cause?.stack}`),
      complete: () => this._logger.debug(`blockchain airdrop pipeline completed`),
    })
  }

  public async sendAirdropTx(airdropReq: AirdropRequestDto): Promise<AirdropResponseDto> {
    let promise;
    try {
      let emitResult = await RxJS.firstValueFrom(
        RxJS.scheduled(
          RxJS.defer(() =>
            RxJS.of(this._eventEmitter.emit(EventType.AIRDROP_REQUEST_EVENT, airdropReq)).pipe(
              RxJS.mergeMap(sendEventResult =>
                RxJS.merge(
                  RxJS.of(sendEventResult).pipe(
                    RxJS.filter(sendEventResult => !!sendEventResult),
                    RxJS.identity
                  ),
                  RxJS.of(sendEventResult).pipe(
                    RxJS.filter(sendEventResult => !sendEventResult),
                    RxJS.mergeMap(_ => RxJS.throwError(() => new BlockchainError('Airdrop Listener Not Found', { code: ErrorCode.AIRDROP_REQUEST_LISTENER_NOT_FOUND })))
                  ),
                )
              ),
            )
          ).pipe(
            RxJS.tap({
              next: value => this._logger.debug(`airdrop request listener found, id: ${airdropReq.id.toString()}`),
              error: RxJS.noop,
              complete: RxJS.noop,
            }),
            RxJS.retry({
              count: 7,
              delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                RxJS.mergeMap(([error, retryCount]) =>
                  RxJS.merge(
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) => err instanceof BlockchainError && count <= 7),
                      RxJS.delay(1000)
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) => err instanceof BlockchainError && count > 7),
                      RxJS.mergeMap(([err,_]) => RxJS.throwError(err))
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,_]) => !(err instanceof BlockchainError)),
                      RxJS.mergeMap(([err,_]) => RxJS.throwError(() => new BlockchainError('blockchain service internal error', err))),
                    )
                  )
                ),
                RxJS.tap(([_, retryCount]) => this._logger.warn(`airdrop request listener not found, retry ${retryCount} . . . `))
              )
            })
          ), RxJS.queueScheduler
        ), { defaultValue: false }
      )
      if(emitResult) {
        promise = this._waitForEvent<AirdropResponseDto>(EventType.AIRDROP_RESPONSE_EVENT, airdropReq.id);
      } else {
        promise = new Promise<AirdropResponseDto>((_, reject) => {
          reject(new BlockchainError('blockchain service eventEmitter internal error', {code: ErrorCode.UNKNOWN_ERROR}))
        })
      }
    } catch (err) {
      promise = new Promise<AirdropResponseDto>((_, reject) => {
        reject(err)
      })
    }
    return promise;
  }

  private _waitForEvent<T>(event: string, id: symbol): Promise<T> {
    return new Promise((resolve, reject) => {
      const success = (val: T) => {
        if (event === EventType.AIRDROP_RESPONSE_EVENT) {
          if (!(val instanceof AirdropResponseDto)) {
            this._eventEmitter.off(EventType.ERROR_EVENT, fail);
            this._eventEmitter.off(event, success);
            reject(new BlockchainError('Invalid Airdrop Request Event Response', {code: ErrorCode.INVALID_REQUEST}));
            return
          }
          let response = <AirdropResponseDto>val
          if (response.id === id) {
            this._eventEmitter.off(EventType.ERROR_EVENT, fail);
            this._eventEmitter.off(event, success);
            resolve(val);
          }
        }
      };

      const fail = (err: Error) => {
        if (err instanceof BlockchainError) {
          if (err.code === ErrorCode.SAFE_MODE.toString()) {
            this._eventEmitter.off(event, success);
            this._eventEmitter.off(EventType.ERROR_EVENT, fail);
            reject(err);
          } else if (err.id === id) {
            this._eventEmitter.off(event, success);
            this._eventEmitter.off(EventType.ERROR_EVENT, fail);
            reject(err);
          }
        }

        this._eventEmitter.off(event, success);
        this._eventEmitter.off(EventType.ERROR_EVENT, fail);
        reject(err);
      };

      this._eventEmitter.on(event, success);
      this._eventEmitter.on(EventType.ERROR_EVENT, fail);
    });
  }

  private retryWithDelay<T>(delay: number, count = 1): RxJS.MonoTypeOperatorFunction<T> {
    return (input) =>
      input.pipe(
        RxJS.retryWhen((errors) =>
          errors.pipe(
            RxJS.scan((acc, error) => ({ count: acc.count + 1, error }), {
              count: 0,
              error: Error,
            }),
            RxJS.tap((current) => {
              if (!(current.error instanceof BlockchainError && current.error.code === ErrorCode.NETWORK_ERROR)  || current.count > count) {
                throw current.error;
              }
              this._logger.warn(`blockchain network failed, retrying ${current.count} . . .`)
            }),
            RxJS.delay(delay)
          )
        )
      );
  }

  public findAll(offset: number, limit: number, sortType: SortType, sortBy: BlockchainSortBy): RxJS.Observable<FindAllType> {
    return RxJS.from(this._entityManager.getRepository(BlockchainTxEntity)
      .findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType,
        },
      })
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll blockchainTx success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll blockchainTx failed`, err)
      }),
      RxJS.map(result => ({data: result[0], total: result[1]})),
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }

  public findByFilter(filter: BlockchainFilterType): RxJS.Observable<FindAllType> {
    return RxJS.from(this._entityManager.getRepository(BlockchainTxEntity)
      .findAndCount({
        where: [
          { txHash: filter.txHash },
          { from: filter.from },
          { to: filter.from },
          { networkName: filter.network },
          { status: filter.status },
        ]
      })
    ).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`findAll blockchainTx success, total: ${result[1]}`),
        error: err => this._logger.error(`findAll blockchainTx failed`, err)
      }),
      RxJS.map(result => ({data: result[0], total: result[1]})),
      RxJS.catchError((_) => RxJS.throwError(() => new HttpException(
        {
          statusCode: '500',
          message: 'Internal Server Error',
          error: 'Internal Server Error'
        }, HttpStatus.INTERNAL_SERVER_ERROR))
      )
    )
  }
}

