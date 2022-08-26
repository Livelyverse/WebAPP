import { Inject, Injectable, Logger } from "@nestjs/common";
import { BigNumber, ContractReceipt, ethers, Wallet } from "ethers";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { AirdropRequestDto, TokenType } from "./dto/airdropRequest.dto";
import { APP_MODE, BLOCK_CHAIN_MODULE_OPTIONS, BlockchainOptions } from "./blockchainConfig";
import { EventEmitter } from "events";
import * as RxJS from "rxjs";
import { AirdropResponseDto } from "./dto/airdropResponse.dto";
import { JsonRpcProvider } from "@ethersproject/providers/src.ts/json-rpc-provider";
import { LivelyToken, LivelyToken__factory } from "@livelyverse/lively-core-onchain/export/types";
import { BlockchainError, ErrorCode } from "./error/blockchainError";
import { IERC20Extra } from "@livelyverse/lively-core-onchain/export/types/token/lively/LivelyToken";
import { ContractTransaction, Event } from "@ethersproject/contracts/src.ts";
import { NetworkTxEntity, TxStatus, TxType } from "./entity/networkTx.entity";
import { TypeORMError } from "typeorm/error/TypeORMError";

export enum EventType {
  AIRDROP_REQUEST_EVENT = 'AIRDROP_REQUEST',
  AIRDROP_RESPONSE_EVENT = 'AIRDROP_RESPONSE',
  ERROR_EVENT = 'ERROR'
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
                      let networkTx = new NetworkTxEntity();
                      networkTx.txHash = tx.hash;
                      networkTx.txType = tx.type === 0 ? TxType.LEGACY : TxType.DEFAULT;
                      networkTx.from = tx.from;
                      networkTx.to = tx.to;
                      networkTx.nonce = tx.nonce;
                      networkTx.gasLimit = tx?.gasLimit?.toBigInt();
                      networkTx.gasPrice = tx?.gasPrice?.toBigInt() ? tx.gasPrice.toBigInt() : 0n;
                      networkTx.maxFeePerGas = tx?.maxFeePerGas?.toBigInt();
                      networkTx.maxPriorityFeePerGas = tx?.maxPriorityFeePerGas?.toBigInt();
                      networkTx.data = tx.data;
                      networkTx.value = tx.value.toBigInt();
                      networkTx.networkChainId = this._jsonRpcProvider.network.chainId;
                      networkTx.networkName = this._jsonRpcProvider.network.name;
                      networkTx.blockNumber = null;
                      networkTx.blockHash = null;
                      networkTx.gasUsed = null;
                      networkTx.effectiveGasPrice = null;
                      networkTx.isByzantium = null;
                      networkTx.failInfo = null;
                      networkTx.status = TxStatus.PENDING;
                      return networkTx;
                    }),
                    RxJS.switchMap((networkTxEntity: NetworkTxEntity) =>
                      RxJS.of(networkTxEntity).pipe(
                        RxJS.mergeMap((networkTx) =>
                          RxJS.from(this._entityManager.createQueryBuilder()
                            .insert()
                            .into(NetworkTxEntity)
                            .values([networkTx])
                            .execute()
                          ).pipe(
                            RxJS.tap((_) => this._logger.log(`save networkTxEntity success, id: ${networkTxEntity.id}`)),
                            RxJS.map((_) => [airdropReq, airdropTx, networkTxEntity]),
                          )
                        ),
                        RxJS.catchError((error) =>
                          RxJS.merge(
                            RxJS.of(error).pipe(
                              RxJS.filter(err => err instanceof TypeORMError),
                              RxJS.map(err => new BlockchainError('blockchain module internal error', {cause: err, code: ErrorCode.DB_OPERATION_FAILED, id: airdropReq.id})),
                              RxJS.tap({
                                next: (error) => {
                                  this._safeMode = true;
                                  this._logger.warn(`save networkTxEntity failed, ${error.stack}`);
                                  this._eventEmitter.emit(EventType.ERROR_EVENT, error)
                                },
                                error: RxJS.noop,
                                complete: RxJS.noop,
                              }),
                            ),
                            RxJS.of(error).pipe(
                              RxJS.filter(err => !(err instanceof TypeORMError)),
                              RxJS.map(err => new BlockchainError('blockchain module internal error', {cause: err, code: ErrorCode.UNKNOWN_ERROR, id: airdropReq.id})),
                              RxJS.tap({
                                next: (error) => {
                                  this._logger.warn(`save networkTxEntity failed, ${error.stack}`);
                                  this._eventEmitter.emit(EventType.ERROR_EVENT, error)
                                },
                                error: RxJS.noop,
                                complete: RxJS.noop,
                              }),
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
                      RxJS.filter((error) => error instanceof Error && Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code')),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
                    ),
                    RxJS.of(err).pipe(
                      RxJS.filter((error) => error instanceof Error),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`finalize batchTransfer token call . . . `)),
                this.retryWithDelay(30000, 3),
              )
            ),
            RxJS.mergeMap((tuple:[AirdropRequestDto, ContractTransaction, NetworkTxEntity]) =>
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
                                let networkTx = tuple[2];
                                networkTx.blockNumber = receiptTx.blockNumber;
                                networkTx.blockHash = receiptTx.blockHash;
                                networkTx.gasUsed = receiptTx.gasUsed.toBigInt();
                                networkTx.effectiveGasPrice = receiptTx.effectiveGasPrice.toBigInt();
                                networkTx.isByzantium = receiptTx.byzantium;
                                networkTx.failInfo = null;
                                networkTx.status = receiptTx.status === 1 ? TxStatus.SUCCESS : TxStatus.FAILED;
                                return [event, networkTx];
                              }),
                              RxJS.switchMap(([event, networkTx]:[Event, NetworkTxEntity]) =>
                                RxJS.of([event, networkTx]).pipe(
                                  RxJS.mergeMap(([event, networkTx]) => RxJS.from(this._entityManager.getRepository(NetworkTxEntity).save(networkTx))),
                                  RxJS.tap({
                                    next: (updateResult) => this._logger.log(`update networkTx success, reqId: ${tuple[0].id.toString()}, txHash: ${updateResult.txHash}, status: ${updateResult.status}, networkTxId: ${updateResult.id}`),
                                    error: (error) => this._logger.error(`update networkTxEntity failed, reqId: ${tuple[0].id.toString()}, txHash: ${networkTx.txHash}, networkTxId: ${networkTx.id}\n${error.stack}`)
                                  }),
                                  RxJS.map(_ => [event, networkTx]),
                                  RxJS.catchError((error) =>
                                    RxJS.merge(
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => err instanceof TypeORMError),
                                        RxJS.mergeMap(err => RxJS.of(networkTx))
                                      ),
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
                                        RxJS.mergeMap(err => RxJS.throwError(() => new BlockchainError('update networkTx failed', {cause: err, code: ErrorCode.NODE_JS_ERROR})))
                                      )
                                    )
                                  )
                                )
                              ),
                            ),
                          ),
                          RxJS.map(([event, networkTxEntity]: [Event, NetworkTxEntity]) => {
                            let response = new AirdropResponseDto();
                            response.id = tuple[0].id;
                            response.recordId = networkTxEntity.id;
                            response.tokenType = tuple[0].tokenType;
                            response.txHash = networkTxEntity.txHash
                            response.from = networkTxEntity.from;
                            response.to = networkTxEntity.to;
                            response.nonce = networkTxEntity.nonce;
                            response.networkChainId = this._jsonRpcProvider.network.chainId;
                            response.networkName = this._jsonRpcProvider.network.name;
                            response.totalAmount = event.args.totalAmount.toBigInt();
                            response.status = networkTxEntity.status;
                            this._eventEmitter.emit(EventType.AIRDROP_RESPONSE_EVENT, response)
                            return response;
                          }),
                          RxJS.tap({
                            next: response => this._logger.log(`airdrop tx of LVL token completed, reqId: ${response.id.toString()}, txHash: ${response.txHash}, amount: ${response.totalAmount.toString()}, recordId: ${response.recordId}`),
                            error: err => {
                              this._logger.error(`airdrop tx of LVL token failed\n${err.stack}\n${err?.cause?.stack}`)
                              this._eventEmitter.emit(EventType.ERROR_EVENT, err)
                            }
                          }),
                          RxJS.catchError((err) => RxJS.EMPTY )
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
             RxJS.filter((error) => !(error instanceof BlockchainError)),
             RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("blockchain airdrop event handler pipeline failed", {cause: error, code: ErrorCode.NODE_JS_ERROR}))),
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
      complete: () => this._logger.log(`blockchain airdrop pipeline completed`),
    })
  }

  public async sendAirdropTx(airdropReq: AirdropRequestDto): Promise<AirdropResponseDto> {
    // this._logger.log(`before AIRDROP_REQUEST_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.AIRDROP_REQUEST_EVENT)}`)
    // this._logger.log(`before AIRDROP_RESPONSE_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.AIRDROP_RESPONSE_EVENT)}`)
    // this._logger.log(`before ERROR_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.ERROR_EVENT)}`)
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
    // this._logger.log(`after AIRDROP_REQUEST_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.AIRDROP_REQUEST_EVENT)}`)
    // this._logger.log(`after AIRDROP_RESPONSE_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.AIRDROP_RESPONSE_EVENT)}`)
    // this._logger.log(`after ERROR_EVENT listener count, count: ${this._eventEmitter.listenerCount(EventType.ERROR_EVENT)}`)
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

  // create(createBlockchainDto: TransactionRequestDto) {
  //   return 'This action adds a new blockchain';
  // }
  //
  // findAll() {
  //
  //   let token: LivelyToken;
  //   let admin: Signer;
  //   let systemAdmin: Signer;
  //
  //   let customHttpProvider = new ethers.providers.JsonRpcProvider('https://boldest-small-river.ethereum-goerli.discover.quiknode.pro/b93d0ba5044bcc5bb7e2cd30a7850f51718ff058/');
  //   customHttpProvider.getBlockNumber().then((result) => {
  //     console.log("Current block number: " + result);
  //   });
  //
  //   return `This action returns all blockchain`;
  // }
  //
  // findOne(id: number) {
  //   return `This action returns a #${id} blockchain`;
  // }
  //
  // update(id: number, updateBlockchainDto: UpdateBlockchainDto) {
  //   return `This action updates a #${id} blockchain`;
  // }
  //
  // remove(id: number) {
  //   return `This action removes a #${id} blockchain`;
  // }
}

