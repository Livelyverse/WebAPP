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
import { JsonRpcProvider, FeeData, Block } from "@ethersproject/providers/src.ts";
import { LivelyToken, LivelyToken__factory } from "@livelyverse/lively-core-onchain/export/types";
import { BlockchainError, ErrorCode } from "./domain/error/blockchainError";
import { IERC20Extra } from "@livelyverse/lively-core-onchain/export/types/token/lively/LivelyToken";
import { ContractTransaction, Event } from "@ethersproject/contracts/src.ts";
import { BlockchainTxEntity, TxStatus, TxType } from "./domain/entity/blockchainTx.entity";
import { TypeORMError } from "typeorm/error/TypeORMError";
import { BlockchainTxViewDto } from "./domain/dto/blockchainTxView.dto";
import { HttpService } from "@nestjs/axios";
import { AxiosError } from "axios";
import { FollowerError } from "../airdrop/domain/error/follower.error";
import { TransactionResponse } from "@ethersproject/abstract-provider";

export interface BlockchainFilterType {
  txHash: string;
  from: string;
  to: string;
  status: TxStatus;
  network: NetworkType;
}

interface GasStationBaseData {
  maxPriorityFee: string,
  maxFee:	string
}

interface GasStationFeeData {
  safeLow: GasStationBaseData,
  standard: GasStationBaseData,
  fast: GasStationBaseData
  estimatedBaseFee:	string,
  blockTime: number,
  blockNumber: number
}

interface TxGasFeeInfo {
  maxFeePerGas: BigNumber,
  maxPriorityFeePerGas: BigNumber
}

enum GasStationType {
  SAFE_LOW,
  STANDARD,
  FAST,
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

type AirdropRequest = {
  id: symbol;
  tokenType: TokenType;
  data: Array<{destination: string, amount: bigint}>;
  signer?: string;
  txHash: string;
}

@Injectable()
export class BlockchainService {
  private readonly _logger = new Logger(BlockchainService.name);
  private readonly _airdropAccount: Wallet;
  private readonly _livelyToken: LivelyToken;
  private readonly _jsonRpcProvider: JsonRpcProvider;
  private readonly _eventEmitter: EventEmitter;
  private readonly _airdropSubscription: RxJS.Subscription;
  private readonly _confirmationCount: number;
  private _safeMode: Boolean;
  private _isReady: Boolean;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    @Inject(BLOCK_CHAIN_MODULE_OPTIONS)
    private readonly _blockchainOptions: BlockchainOptions,
    private readonly _configService: ConfigService,
    private readonly _httpService: HttpService
  ) {
    let airdropAccountConfig = this._blockchainOptions.config.accounts.find((account) => account.name.toLowerCase() === 'airdropaccount');
    let livelyTokenConfig = this._blockchainOptions.config.tokens.find((token) => token.name.toUpperCase() === 'LIV')
    this._jsonRpcProvider = new ethers.providers.JsonRpcProvider({
        url: this._blockchainOptions.config.network.url,
        timeout: this._blockchainOptions.config.network.jsonRpcTimeout
      }
      // ,{
      // name: this._blockchainOptions.config.network.name,
      // chainId: this._blockchainOptions.config.network.chainId,
      // _defaultProvider: (providers) => new providers.JsonRpcProvider(this._blockchainOptions.config.network.url)
    );
    const livelyTokenAddress = ethers.utils.getAddress(livelyTokenConfig.address)
    this._airdropAccount = new ethers.Wallet(airdropAccountConfig.privateKey, this._jsonRpcProvider);
    this._livelyToken = LivelyToken__factory.connect(livelyTokenAddress, this._airdropAccount);
    this._eventEmitter = new EventEmitter();
    this._safeMode = false;
    this._isReady = false;
    this._confirmationCount = this._blockchainOptions.appMode == APP_MODE.DEV ? 0 : this._blockchainOptions.appMode == APP_MODE.TEST ? 3 : 7
    this._airdropSubscription = this._airdropInit();
    this._airdropPreInit();
  }

  private _airdropPreInit() {
    RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).findAndCount(
      {
        where: {
          status: TxStatus.PENDING
        }
      })).pipe(
      RxJS.tap({
        next: result => this._logger.debug(`find pending blockchainTx success, total: ${result[1]}`),
        error: err => this._logger.error(`find pending blockchainTx failed`, err)
      }),
      RxJS.map(result => result[0]),
      RxJS.concatMap(queryResult => RxJS.from(queryResult).pipe(RxJS.map(result => ({blockchainTx: result, counter: 0})))),
      RxJS.concatMap( ({blockchainTx, counter}) =>
        RxJS.defer(() => RxJS.of({blockchainTx, counter})).pipe(
          RxJS.scan((acc) => acc.counter = acc.counter + 1, {blockchainTx, counter}),
          RxJS.tap(retryCounter => this._logger.debug(`resending airdrop blockchain pending tx, txHash: ${blockchainTx.txHash}, nonce: ${blockchainTx.nonce}, resendCount: ${retryCounter} . . .`)),
          RxJS.map(retryCounter => ({retryCounter, blockchainTx})),

          // calculate gas fee
          RxJS.mergeMap(data =>
            this._getTxGasFee(data.retryCounter <= this._blockchainOptions.config.network.sendTxRetry / 2 ? GasStationType.STANDARD : GasStationType.FAST,
              this._blockchainOptions.config.network.extraGasTip > 0  && this._blockchainOptions.config.network.sendTxRetry > 0 ?
                this._blockchainOptions.config.network.extraGasTip * (data.retryCounter / this._blockchainOptions.config.network.sendTxRetry): 0,
              this._blockchainOptions.config.network.networkCongest)
              .pipe(
                RxJS.map( txGasFeeInfo => ({txGasFeeInfo, ...data}))
              )
          ),

          // send tx to blockchain
          RxJS.switchMap((requestData) =>
            RxJS.defer(() => RxJS.from(this._airdropAccount.sendTransaction({
                to: this._livelyToken.address,
                data: requestData.blockchainTx.data,
                maxFeePerGas: requestData.txGasFeeInfo.maxFeePerGas.isZero() ? null : requestData.txGasFeeInfo.maxFeePerGas ,
                maxPriorityFeePerGas: requestData.txGasFeeInfo.maxPriorityFeePerGas.isZero() ? null : requestData.txGasFeeInfo.maxPriorityFeePerGas
              })).pipe(
                RxJS.map(airdropTx => ({airdropTx, ...requestData})),
                RxJS.mergeMap( data =>
                  RxJS.of(data).pipe(
                    RxJS.map(airdropData => {
                      airdropData.blockchainTx.txHash = airdropData.airdropTx.hash;
                      airdropData.blockchainTx.txType = airdropData.airdropTx.type === 0 ? TxType.LEGACY : TxType.DEFAULT;
                      // airdropData.blockchainTx.from = airdropData.airdropTx.from;
                      // airdropData.blockchainTx.to = airdropData.airdropTx.to;
                      airdropData.blockchainTx.nonce = airdropData.airdropTx.nonce;
                      airdropData.blockchainTx.gasLimit = airdropData.airdropTx?.gasLimit?.toBigInt();
                      airdropData.blockchainTx.gasPrice = airdropData.airdropTx?.gasPrice?.toBigInt() ? airdropData.airdropTx.gasPrice.toBigInt() : 0n;
                      airdropData.blockchainTx.maxFeePerGas = airdropData.airdropTx?.maxFeePerGas?.toBigInt();
                      airdropData.blockchainTx.maxPriorityFeePerGas = airdropData.airdropTx?.maxPriorityFeePerGas?.toBigInt();
                      // airdropData.blockchainTx.data = airdropData.airdropTx.data;
                      airdropData.blockchainTx.value = airdropData.airdropTx.value.toBigInt();
                      // airdropData.blockchainTx.networkChainId = this._jsonRpcProvider.network.chainId;
                      // airdropData.blockchainTx.networkName = this._jsonRpcProvider.network.name;
                      // airdropData.blockchainTx.blockNumber = null;
                      // airdropData.blockchainTx.blockHash = null;
                      // airdropData.blockchainTx.gasUsed = null;
                      // airdropData.blockchainTx.effectiveGasPrice = null;
                      // airdropData.blockchainTx.isByzantium = null;
                      // airdropData.blockchainTx.failInfo = null;
                      // airdropData.blockchainTx.status = TxStatus.PENDING;
                      return airdropData;
                    }),
                    RxJS.switchMap(airdropData =>
                      RxJS.of(airdropData).pipe(
                        RxJS.mergeMap(airdropData =>
                          RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(airdropData.blockchainTx)
                          ).pipe(
                            RxJS.tap({
                              next: (_) => this._logger.log(`update blockchainTxEntity success, id: ${airdropData.blockchainTx.id}, txHash: ${airdropData.blockchainTx.txHash}`),
                              error: err => this._logger.error(`update blockchainTxEntity failed, txHash: ${airdropData.blockchainTx.txHash}`, err)
                            }),
                            RxJS.map((blockChainTxEntity) => ({airdropTx: airdropData.airdropTx, blockchainTx: blockChainTxEntity, retryCounter: airdropData.retryCounter, txGasFeeInfo: airdropData.txGasFeeInfo})),
                          )
                        ),
                      )
                    ),
                  )
                ),
                RxJS.catchError((err) =>
                  RxJS.merge(
                    RxJS.of(err).pipe(
                      // block chain error handling
                      RxJS.filter((error) => error instanceof Error && (Object.hasOwn(error, 'event') || Object.hasOwn(error, 'code'))),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
                    ),
                    RxJS.of(err).pipe(
                      // general error handling
                      RxJS.filter((error) => error instanceof Error && !(Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code'))),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`finalize resend transaction call . . . `)),
                RxJS.retry({
                  count: 7,
                  resetOnSuccess: true,
                  delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                    RxJS.mergeMap(([error, retryCount]) =>
                      RxJS.merge(
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count < 7),
                          RxJS.tap({
                            error: _ => this._logger.warn(`blockchain network failed . . . `)
                          }),
                          RxJS.delay(60000 * retryCount),
                          RxJS.tap(([_, retryCount]) => this._logger.warn(`sending tx to blockchain, retry ${retryCount} . . . `))
                        ),
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,count]) =>
                            (err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count >= 7) ||
                            err instanceof BlockchainError && err.code != ErrorCode.NETWORK_ERROR
                          ),
                          RxJS.tap({
                            error: err => this._logger.error(`send blockchain tx failed`, err)
                          }),
                          RxJS.mergeMap(([err, _]) => RxJS.throwError(() => err))
                        ),
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,_]) => !(err instanceof BlockchainError) && err instanceof Error),
                          RxJS.tap({
                            error: err => this._logger.error(`send blockchain tx failed`, err)
                          }),
                          RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new BlockchainError("send blockchain tx failed", err)))
                        ),
                      )
                    )
                  )
                }),
                RxJS.tap({
                  next: (airdropData) => this._logger.log(`resend airdrop tx to blockchain success, txHash: ${airdropData.airdropTx.hash}`),
                  error: err => this._logger.error(`resend airdrop tx to blockchain failed\ncause: ${err?.cause?.stack}`, err)
                }),
              )
            ),
          ),

          // waiting for tx
          RxJS.mergeMap((airdropData: {airdropTx: TransactionResponse, blockchainTx: BlockchainTxEntity, retryCounter: number, txGasFeeInfo: TxGasFeeInfo}) =>
            RxJS.of(this._confirmationCount).pipe(
              RxJS.switchMap((confirmationCount) =>
                RxJS.from(airdropData.airdropTx.wait(confirmationCount)).pipe(
                  RxJS.timeout({
                    each: this._blockchainOptions.config.network.sendTxTimeout,
                    with: () => RxJS.throwError(() => new BlockchainError("airdrop tx timeout", {code: ErrorCode.TIMER_TIMEOUT}))
                  }),
                  RxJS.tap({
                    next: (airdropReceiptTx: ContractReceipt) => this._logger.debug(`get tx airdrop receipt success, txHash: ${airdropReceiptTx.transactionHash}, txStatus: ${airdropReceiptTx.status}`),
                    error: (err) => this._logger.error(`get tx airdrop receipt failed, err: ${err.message}, code: ${err?.code}`, err)
                  }),
                  RxJS.mergeMap((airdropReceiptTx: ContractReceipt) =>
                    RxJS.of(airdropReceiptTx).pipe(
                      RxJS.tap((airdropReceiptTx) => this._logger.log(`get resend airdrop tx receipt success, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
                      RxJS.mergeMap(airdropReceiptTx =>
                        RxJS.merge(
                          RxJS.of(airdropReceiptTx).pipe(
                            RxJS.filter(receiptTx => receiptTx.events.length > 0),
                            RxJS.mergeMap(receiptTx =>
                              RxJS.from(receiptTx.events).pipe(
                                RxJS.filter((txEvent: Event) => txEvent.event === 'BatchTransfer' ),
                                RxJS.take(1),
                                RxJS.map(event => ({event, receiptTx}))
                              )
                            )
                          ),
                          RxJS.of(airdropReceiptTx).pipe(
                            RxJS.filter(receiptTx => !receiptTx.events.length),
                            RxJS.mergeMap(_ => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", {code: ErrorCode.INVALID_TX_RECEIPT})))
                          )
                        )
                      ),
                      RxJS.map(({event, receiptTx}) => {
                        blockchainTx.blockNumber = receiptTx.blockNumber;
                        blockchainTx.blockHash = receiptTx.blockHash;
                        blockchainTx.gasUsed = receiptTx.gasUsed.toBigInt();
                        blockchainTx.effectiveGasPrice = receiptTx.effectiveGasPrice.toBigInt();
                        blockchainTx.isByzantium = receiptTx.byzantium;
                        blockchainTx.failInfo = null;
                        blockchainTx.status = receiptTx.status === 1 ? TxStatus.SUCCESS : TxStatus.FAILED;
                        return ({event, blockchainTx});
                      }),

                      // update blockchainTxEntity
                      RxJS.switchMap(({event, blockchainTx}) =>
                        RxJS.of({event, blockchainTx}).pipe(
                          RxJS.mergeMap((info) => RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(info.blockchainTx))),
                          RxJS.tap({
                            next: (updateResult) => this._logger.log(`update blockchainTxEntity success, txHash: ${updateResult.txHash}, status: ${updateResult.status}, blockchainTxId: ${updateResult.id}`),
                            error: (error) => this._logger.error(`update blockchainTxEntity failed, txHash: ${blockchainTx.txHash}, blockchainTxId: ${blockchainTx.id}`, error)
                          }),
                          RxJS.map(_ => ({event, blockchainTx})),
                          RxJS.catchError((error) =>
                            RxJS.merge(
                              RxJS.of(error).pipe(
                                RxJS.filter(err => err instanceof TypeORMError),
                                RxJS.mergeMap(_ => RxJS.of(blockchainTx))
                              ),
                              RxJS.of(error).pipe(
                                RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
                                RxJS.mergeMap(err => RxJS.throwError(() => new BlockchainError('update blockchainTx failed', {cause: err, code: ErrorCode.NODE_JS_ERROR})))
                              )
                            )
                          )
                        )
                      ),
                    )
                  )
                )
              )
            )
          ),
          RxJS.catchError((err) =>
            RxJS.merge(
              RxJS.of(err).pipe(
                // block chain error handling
                RxJS.filter((error) => error instanceof Error && (Object.hasOwn(error, 'event') || Object.hasOwn(error, 'code'))),
                RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
              ),
              RxJS.of(err).pipe(
                // general error handling
                RxJS.filter((error) => error instanceof Error && !(Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code'))),
                RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
              ),
              RxJS.of(err).pipe(
                RxJS.filter((error) => error instanceof BlockchainError),
                RxJS.mergeMap((error) => RxJS.throwError(() => error))
              )
            )
          ),
          RxJS.finalize(() => this._logger.debug(`finalize get airdrop resend tx receipt. . . `)),
          RxJS.retry({
            count: this._blockchainOptions.config.network.sendTxRetry + 7,
            resetOnSuccess: true,
            delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
              RxJS.mergeMap(([error, retryCount]) =>
                RxJS.merge(
                  RxJS.of([error, retryCount]).pipe(
                    RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code === ErrorCode.TIMER_TIMEOUT && count < this._blockchainOptions.config.network.sendTxRetry),
                    RxJS.tap({
                      error: _ => this._logger.warn(`tx gasFee failed . . . `)
                    }),
                    RxJS.tap(([_, retryCount]) => this._logger.warn(`send tx to blockchain tx , retry ${retryCount} . . . `)),
                  ),
                  RxJS.of([error, retryCount]).pipe(
                    RxJS.filter(([err,count]) => err instanceof BlockchainError && (err.code === ErrorCode.NETWORK_ERROR || err.code === ErrorCode.NETWORK_TIMEOUT) && count < 7),
                    RxJS.tap({
                      error: _ => this._logger.warn(`blockchain network failed . . . `)
                    }),
                    RxJS.delay(60000 * retryCount),
                    RxJS.tap(([_, retryCount]) => this._logger.warn(`sending tx to blockchain, retry ${retryCount} . . . `))
                  ),
                  RxJS.of([error, retryCount]).pipe(
                    RxJS.filter(([err,count]) =>
                      (err instanceof BlockchainError && err.code === ErrorCode.TIMER_TIMEOUT && count >= this._blockchainOptions.config.network.sendTxRetry)
                    ),
                    RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new BlockchainError("waiting for send blockchain tx failed", err)))
                  ),
                  RxJS.of([error, retryCount]).pipe(
                    RxJS.filter(([err,count]) =>
                      (err instanceof BlockchainError && (err.code === ErrorCode.NETWORK_ERROR || err.code === ErrorCode.NETWORK_TIMEOUT) && count >= 7) ||
                      (err instanceof BlockchainError && err.code !== ErrorCode.NETWORK_TIMEOUT && err.code !== ErrorCode.NETWORK_ERROR && err.code !== ErrorCode.TIMER_TIMEOUT)
                    ),
                    RxJS.tap({
                      error: err => this._logger.error(`send tx to blockchain failed`, err)
                    }),
                    RxJS.mergeMap(([err, _]) => RxJS.throwError(() => err))
                  ),
                  RxJS.of([error, retryCount]).pipe(
                    RxJS.filter(([err,_]) => !(err instanceof BlockchainError) && err instanceof Error),
                    RxJS.tap({
                      error: err => this._logger.error(`send or wait blockchain tx failed`, err)
                    }),
                    RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new BlockchainError("send or wait blockchain tx failed", err)))
                  ),
                )
              )
            )
          }),
        )
      )
    ).subscribe({
      next: _ => RxJS.noop(),
      error: err => this._logger.error(`resending airdrop pend blockchain tx failed`, err),
      complete: () => {
        this._logger.log(`resending airdrop pend blockchain tx completed . . .`);
        this._isReady = true;
      },
    })
  }

  private _airdropInit() {
    return RxJS.defer(() =>
      RxJS.fromEvent(this._eventEmitter, EventType.AIRDROP_REQUEST_EVENT).pipe(
        RxJS.observeOn(RxJS.asyncScheduler),
        // safe mode check
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

        // token check
        RxJS.mergeMap((airdropReq: AirdropRequestDto) =>
          RxJS.merge(
            RxJS.of(airdropReq).pipe(
              RxJS.filter(request => request.tokenType !== TokenType.LIV),
              RxJS.tap((request) => this._logger.warn(`airdrop token request not supported, id: ${request.id.toString()}`)),
              RxJS.mergeMap((request) => {
                this._eventEmitter.emit(EventType.ERROR_EVENT, new BlockchainError('Invalid Airdrop Token Request', {code: ErrorCode.INVALID_REQUEST, id: request.id}))
                return RxJS.EMPTY
              })
            ),
            RxJS.of(airdropReq).pipe(
              RxJS.filter(request => request.tokenType === TokenType.LIV),
              RxJS.identity
            )
          )
        ),

        // request data map
        RxJS.concatMap((airdropReq:AirdropRequestDto) =>
          RxJS.from(airdropReq.data).pipe(
            RxJS.map((data) => (<IERC20Extra.BatchTransferRequestStruct>{to: data.destination, amount: BigNumber.from(data.amount)})),
            RxJS.toArray(),
            RxJS.map((batchTransfers) => ({airdropReq: Object.defineProperty(airdropReq, 'txHash', { value: "", writable: true}), batchTransfers, retryCounter: 0}))
          )
        ),

        // send tx
        RxJS.concatMap((requestData: {airdropReq: AirdropRequest, batchTransfers: IERC20Extra.BatchTransferRequestStruct[], retryCounter: number}) =>
          RxJS.defer(() => RxJS.of(requestData)).pipe(
            RxJS.filter((_) => !this._safeMode),
            RxJS.scan((acc) =>  acc.retryCounter = acc.retryCounter + 1, requestData),
            RxJS.tap(retryCounter => this._logger.debug(`sending airdrop blockchain pending tx, requestId: ${requestData.airdropReq.id.toString()}, resendCount: ${retryCounter} . . .`)),
            RxJS.map(retryCounter => ({airdropReq: requestData.airdropReq, batchTransfers: requestData.batchTransfers, retryCounter: retryCounter})),

            // calculate gas fee
            RxJS.mergeMap(({airdropReq, batchTransfers, retryCounter}) =>
              this._getTxGasFee(retryCounter <= this._blockchainOptions.config.network.sendTxRetry / 2 ? GasStationType.STANDARD : GasStationType.FAST,
                this._blockchainOptions.config.network.extraGasTip > 0  && this._blockchainOptions.config.network.sendTxRetry > 0 ?
                  this._blockchainOptions.config.network.extraGasTip * (retryCounter / this._blockchainOptions.config.network.sendTxRetry): 0,
                this._blockchainOptions.config.network.networkCongest)
                .pipe(
                  RxJS.map( txGasFeeInfo => ({airdropReq, batchTransfers, retryCounter, txGasFeeInfo}))
                )
            ),

            // send tx to blockchain
            RxJS.switchMap(({airdropReq, batchTransfers, retryCounter, txGasFeeInfo}) =>
              RxJS.defer(() =>
                RxJS.from(this._livelyToken.connect(this._airdropAccount).batchTransfer(batchTransfers,
                  {
                    maxFeePerGas: txGasFeeInfo.maxFeePerGas.isZero() ? null : txGasFeeInfo.maxFeePerGas ,
                    maxPriorityFeePerGas: txGasFeeInfo.maxPriorityFeePerGas.isZero() ? null : txGasFeeInfo.maxPriorityFeePerGas
                  }))
              ).pipe(
                RxJS.mergeMap((airdropTx: ContractTransaction) =>
                  RxJS.merge(
                    RxJS.of(airdropTx).pipe(
                      RxJS.filter(_ => !airdropReq.txHash),
                      RxJS.concatMap( (airdropTx: ContractTransaction) =>
                        RxJS.of(airdropTx).pipe(
                          RxJS.map(tx => {
                            airdropReq['txHash'] = tx.hash;
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
                                  RxJS.map((_) => ({airdropReq, airdropTx, blockchainTx, retryCounter})),
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
                                  RxJS.mergeMap( _ => RxJS.of({airdropReq, airdropTx, blockchainTx: null, retryCounter}))
                                )
                              ),
                            )
                          )
                        )
                      ),
                    ),
                    RxJS.of(airdropTx).pipe(
                      RxJS.filter(_ => !!airdropReq.txHash),
                      RxJS.concatMap( (airdropTx: ContractTransaction) =>
                        RxJS.of(airdropTx).pipe(
                          RxJS.mergeMap(airdropTx =>
                            RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).findOneOrFail(
                              {
                                where: {
                                  txHash: airdropReq.txHash
                                }
                              })).pipe(
                              RxJS.tap({
                                next: (blockchainTx) => this._logger.debug(`airdrop blockchainTx found, txHash: ${blockchainTx.txHash},  txStatus: ${blockchainTx.status}`),
                                error: (err) => this._logger.error(`find airdrop blockchainTx failed, txHash: ${airdropReq.txHash}`,err)
                              }),
                              // RxJS.catchError(err => RxJS.throwError(() => new BlockchainError('blockchain service internal error', {code: ErrorCode.DB_OPERATION_FAILED, cause: err, id: airdropReq.id}))),
                            )
                          ),
                          RxJS.map(blockchainTx => {
                            blockchainTx.txHash = airdropTx.hash;
                            blockchainTx.txType = airdropTx.type === 0 ? TxType.LEGACY : TxType.DEFAULT;
                            // blockchainTx.from = airdropTx.from;
                            // blockchainTx.to = airdropTx.to;
                            blockchainTx.nonce = airdropTx.nonce;
                            blockchainTx.gasLimit = airdropTx?.gasLimit?.toBigInt();
                            blockchainTx.gasPrice = airdropTx?.gasPrice?.toBigInt() ? airdropTx.gasPrice.toBigInt() : 0n;
                            blockchainTx.maxFeePerGas = airdropTx?.maxFeePerGas?.toBigInt();
                            blockchainTx.maxPriorityFeePerGas = airdropTx?.maxPriorityFeePerGas?.toBigInt();
                            // blockchainTx.data = airdropTx.data;
                            // blockchainTx.value = airdropTx.value.toBigInt();
                            // blockchainTx.networkChainId = this._jsonRpcProvider.network.chainId;
                            // blockchainTx.networkName = this._jsonRpcProvider.network.name;
                            // blockchainTx.blockNumber = null;
                            // blockchainTx.blockHash = null;
                            // blockchainTx.gasUsed = null;
                            // blockchainTx.effectiveGasPrice = null;
                            // blockchainTx.isByzantium = null;
                            // blockchainTx.failInfo = null;
                            // blockchainTx.status = TxStatus.PENDING;
                            return blockchainTx;
                          }),
                          RxJS.switchMap((blockchainTxEntity: BlockchainTxEntity) =>
                            RxJS.of(blockchainTxEntity).pipe(
                              RxJS.mergeMap((blockchainTx) =>
                                RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(blockchainTx)
                                ).pipe(
                                  RxJS.tap({
                                    next: (_) => this._logger.log(`update blockchainTxEntity success, id: ${blockchainTx.id}, txHash: ${blockchainTx.txHash}`),
                                    error: err => this._logger.error(`update blockchainTxEntity failed, txHash: ${blockchainTx.txHash}\n${err.stack}`,err)
                                  }),
                                  RxJS.map((_) => ({airdropReq, airdropTx, blockchainTx, retryCounter})),
                                  // RxJS.catchError((error) =>
                                  //   RxJS.merge(
                                  //     RxJS.of(error).pipe(
                                  //       RxJS.filter(err => err instanceof TypeORMError),
                                  //       RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.DB_OPERATION_FAILED, id: airdropReq.id})),
                                  //       RxJS.mergeMap(err => RxJS.throwError(() => err))
                                  //     ),
                                  //     RxJS.of(error).pipe(
                                  //       RxJS.filter(err => err instanceof BlockchainError),
                                  //       RxJS.mergeMap(err => RxJS.throwError(() => err))
                                  //     ),
                                  //   ).pipe(
                                  //     RxJS.mergeMap( _ => RxJS.of({airdropReq, airdropTx, blockchainTx: null, retryCounter}))
                                  //   )
                                  // ),
                                )
                              ),
                            )
                          ),
                          RxJS.catchError((error) =>
                            RxJS.merge(
                              RxJS.of(error).pipe(
                                RxJS.filter(err => err instanceof TypeORMError),
                                RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.DB_OPERATION_FAILED, id: airdropReq.id})),
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
                              RxJS.mergeMap( _ => RxJS.of({airdropReq, airdropTx, blockchainTx: null, retryCounter}))
                            )
                          ),
                        )
                      ),
                    )
                  )
                ),
                RxJS.catchError((err) =>
                  RxJS.merge(
                    RxJS.of(err).pipe(
                      // block chain error handling
                      RxJS.filter((error) => error instanceof Error && (Object.hasOwn(error, 'event') || Object.hasOwn(error, 'code'))),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
                    ),
                    RxJS.of(err).pipe(
                      // general nodejs error handling
                      RxJS.filter((error) => error instanceof Error && !(Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code'))),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
                    ),
                    RxJS.of(err).pipe(
                      // general error handling
                      RxJS.filter((error) => !(error instanceof Error)),
                      RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.UNKNOWN_ERROR})))
                    )
                  )
                ),
                RxJS.finalize(() => this._logger.debug(`finalize batchTransfer token call . . . `)),
                RxJS.retry({
                  count: 7,
                  resetOnSuccess: true,
                  delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                    RxJS.mergeMap(([error, retryCount]) =>
                      RxJS.merge(
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count < 7),
                          RxJS.tap({
                            error: _ => this._logger.warn(`blockchain network failed . . . `)
                          }),
                          RxJS.delay(60000 * retryCount),
                          RxJS.tap(([_, retryCount]) => this._logger.warn(`sending airdrop tx to blockchain, requestId: ${airdropReq.id.toString()}, retry ${retryCount} . . . `))
                        ),
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,count]) =>
                            (err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count >= 7) ||
                            err instanceof BlockchainError && err.code != ErrorCode.NETWORK_ERROR
                          ),
                          RxJS.tap({
                            error: err => this._logger.error(`send blockchain tx failed, requestId: ${airdropReq.id.toString()}`, err)
                          }),
                          RxJS.mergeMap(([err, _]) => RxJS.throwError(() => err))
                        ),
                        RxJS.of([error, retryCount]).pipe(
                          RxJS.filter(([err,_]) => !(err instanceof BlockchainError) && err instanceof Error),
                          RxJS.tap({
                            error: err => this._logger.error(`send blockchain tx failed`, err)
                          }),
                          RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new BlockchainError("send blockchain tx failed", err)))
                        ),
                      )
                    )
                  )
                }),
                RxJS.tap({
                  next: ({airdropReq, airdropTx, blockchainTx, retryCounter}) => this._logger.log(`send airdrop tx to blockchain success, token: ${airdropReq.tokenType}, txHash: ${airdropTx.hash}`),
                  error: err => this._logger.error(`send airdrop tx to blockchain failed\ncause: ${err?.cause?.stack}`, err)
                }),
              )
            ),

            // wait for tx
            RxJS.mergeMap(({airdropReq, airdropTx, blockchainTx, retryCounter}) =>
              RxJS.of(this._confirmationCount).pipe(
                RxJS.switchMap((confirmationCount) =>
                  RxJS.from(airdropTx.wait(confirmationCount)).pipe(
                    RxJS.timeout({
                      each: this._blockchainOptions.config.network.sendTxTimeout,
                      with: () => RxJS.throwError(() => new BlockchainError("airdrop tx timeout", {code: ErrorCode.NETWORK_TIMEOUT}))
                    }),
                    RxJS.tap({
                      next: (airdropReceiptTx: ContractReceipt) => this._logger.debug(`get tx airdrop receipt success, txHash: ${airdropReceiptTx.transactionHash}, txStatus: ${airdropReceiptTx.status}`),
                      error: (err) => this._logger.error(`get tx airdrop receipt failed, err: ${err.message}, code: ${err?.code}`, err)
                    }),
                    RxJS.mergeMap((airdropReceiptTx: ContractReceipt) =>
                      RxJS.merge(
                        // blockchainEntity doesn't persist
                        RxJS.of(airdropReceiptTx).pipe(
                          RxJS.filter((_) => !blockchainTx),
                          RxJS.tap((airdropReceiptTx) => this._logger.warn(`get receipt of airdrop batchTransfer tx success, but tx doesn't persist, id: ${airdropReq.id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
                          RxJS.mergeMap(_ => RxJS.EMPTY)
                        ),

                        // blockchainEntity updated
                        RxJS.of(airdropReceiptTx).pipe(
                          RxJS.filter((_) => !!blockchainTx),
                          RxJS.tap((airdropReceiptTx) => this._logger.log(`airdrop batchTransfer receipt tx, id: ${airdropReq.id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
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
                                        RxJS.map(event => ({event, receiptTx}))
                                      )
                                    )
                                  ),
                                  RxJS.of(airdropReceiptTx).pipe(
                                    RxJS.filter(receiptTx => !receiptTx.events.length),
                                    RxJS.tap(receiptTx => this._logger.error(`airdrop batchTransfer receipt tx invalid, event length is zero, id: ${airdropReq.id.toString()}, txHash: ${receiptTx.transactionHash}, status: ${receiptTx.status} `)),
                                    RxJS.mergeMap(_ => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", {code: ErrorCode.INVALID_TX_RECEIPT})))
                                  )
                                )
                              ),
                              RxJS.map(({event, receiptTx}) => {
                                // let blockchainTx = tuple[2];
                                blockchainTx.blockNumber = receiptTx.blockNumber;
                                blockchainTx.blockHash = receiptTx.blockHash;
                                blockchainTx.gasUsed = receiptTx.gasUsed.toBigInt();
                                blockchainTx.effectiveGasPrice = receiptTx.effectiveGasPrice.toBigInt();
                                blockchainTx.isByzantium = receiptTx.byzantium;
                                blockchainTx.failInfo = null;
                                blockchainTx.status = receiptTx.status === 1 ? TxStatus.SUCCESS : TxStatus.FAILED;
                                return ({event, blockchainTx});
                              }),
                              // update blockchainTxEntity
                              RxJS.switchMap(({event, blockchainTx}) =>
                                RxJS.of({event, blockchainTx}).pipe(
                                  RxJS.mergeMap((info) => RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(info.blockchainTx))),
                                  RxJS.tap({
                                    next: (updateResult) => this._logger.log(`update blockchainTxEntity success, reqId: ${airdropReq.id.toString()}, txHash: ${updateResult.txHash}, status: ${updateResult.status}, blockchainTxId: ${updateResult.id}`),
                                    error: (error) => this._logger.error(`update blockchainTxEntity failed, reqId: ${airdropReq.id.toString()}, txHash: ${blockchainTx.txHash}, blockchainTxId: ${blockchainTx.id}`,error)
                                  }),
                                  RxJS.map(_ => ({event, blockchainTx})),
                                  RxJS.catchError((error) =>
                                    RxJS.merge(
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => err instanceof TypeORMError),
                                        RxJS.tap({
                                          next: (error) => {
                                            this._safeMode = true;
                                            this._logger.warn(`blockchain service safe mode activated . . . `)},
                                        }),
                                        RxJS.mergeMap(_ => RxJS.of(blockchainTx))
                                      ),
                                      RxJS.of(error).pipe(
                                        RxJS.filter(err => !(err instanceof TypeORMError)),
                                        RxJS.mergeMap(_ => RxJS.of(blockchainTx)),
                                      ),
                                    )
                                  ),
                                )
                              ),
                            ),
                          ),
                          RxJS.map(({event, blockchainTxEntity}) => {
                            let response = new AirdropResponseDto();
                            response.id = airdropReq.id;
                            response.recordId = blockchainTxEntity.id;
                            response.tokenType = airdropReq.tokenType;
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
                              this._logger.error(`airdrop tx token failed, txHash: ${airdropReceiptTx.transactionHash}\ncause: ${err?.cause?.stack}`, err)
                              this._eventEmitter.emit(EventType.ERROR_EVENT, err)
                            }
                          }),
                          RxJS.catchError((_) => RxJS.EMPTY)
                        )
                      )
                    )
                  )
                )
              )
            ),

            RxJS.catchError((err) =>
              RxJS.merge(
                RxJS.of(err).pipe(
                  // block chain error handling
                  RxJS.filter((error) => error instanceof Error && (Object.hasOwn(error, 'event') || Object.hasOwn(error, 'code'))),
                  RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
                ),
                RxJS.of(err).pipe(
                  // general error handling
                  RxJS.filter((error) => error instanceof Error && !(Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code'))),
                  RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
                ),
                RxJS.of(err).pipe(
                  RxJS.filter((error) => error instanceof BlockchainError),
                  RxJS.mergeMap((error) => RxJS.throwError(() => error))
                )
              )
            ),
            RxJS.finalize(() => this._logger.debug(`finalize get airdrop tx receipt. . . `)),
            RxJS.retry({
              count: this._blockchainOptions.config.network.sendTxRetry + 7,
              resetOnSuccess: true,
              delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                RxJS.mergeMap(([error, retryCount]) =>
                  RxJS.merge(
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code === ErrorCode.NETWORK_TIMEOUT && count < this._blockchainOptions.config.network.sendTxRetry),
                      RxJS.tap({
                        error: _ => this._logger.warn(`tx gasFee failed . . . `)
                      }),
                      RxJS.tap(([_, retryCount]) => this._logger.warn(`send tx to blockchain tx , retry ${retryCount} . . . `)),
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count < 7),
                      RxJS.tap({
                        error: _ => this._logger.warn(`blockchain network failed . . . `)
                      }),
                      RxJS.delay(60000 * retryCount),
                      RxJS.tap(([_, retryCount]) => this._logger.warn(`sending tx to blockchain, retry ${retryCount} . . . `))
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) =>
                        (err instanceof BlockchainError && err.code === ErrorCode.NETWORK_TIMEOUT && count >= this._blockchainOptions.config.network.sendTxRetry)
                      ),
                      RxJS.tap({
                        next: ([err, _]) => {
                          this._safeMode = true;
                          this._logger.warn(`waiting for blockchain receipt tx failed, blockchain service safe mode activated . . .`)
//                            this._eventEmitter.emit(EventType.ERROR_EVENT, error)
                        },
                        error: RxJS.noop,
                        complete: RxJS.noop,
                      }),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => err))
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,count]) =>
                        (err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR && count >= 7) ||
                        (err instanceof BlockchainError && err.code !== ErrorCode.NETWORK_TIMEOUT && err.code !== ErrorCode.NETWORK_ERROR)
                      ),
                      RxJS.tap({
                        error: err => this._logger.error(`send tx to blockchain failed`, err)
                      }),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => err))
                    ),
                    RxJS.of([error, retryCount]).pipe(
                      RxJS.filter(([err,_]) => !(err instanceof BlockchainError) && err instanceof Error),
                      RxJS.tap({
                        error: err => this._logger.error(`send or wait blockchain tx failed`, err)
                      }),
                      RxJS.mergeMap(([err, _]) => RxJS.throwError(() => new BlockchainError("send or wait blockchain tx failed", err)))
                    ),
                  )
                )
              )
            }),
            RxJS.tap({
              // next: (response) => this._logger.log(`get airdrop tx receipt from blockchain success, token: ${response.tokenType}, txHash: ${response.txHash}, txStatus: ${response.status}`),
              error: err => this._logger.error(`get airdrop tx receipt from blockchain failed\ncause: ${err?.cause?.stack}`, err)
            }),
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
      error: err => this._logger.error(`blockchain airdrop pipeline failed,\ncause: ${err?.cause?.stack}`, err),
      complete: () => this._logger.debug(`blockchain airdrop pipeline completed`),
    })
  }

  // private _airdropInit_orig() {
  //   return RxJS.defer(() =>
  //     RxJS.fromEvent(this._eventEmitter, EventType.AIRDROP_REQUEST_EVENT).pipe(
  //       RxJS.observeOn(RxJS.asyncScheduler),
  //       RxJS.mergeMap((airdropReq: AirdropRequestDto) =>
  //         RxJS.merge(
  //           RxJS.of(airdropReq).pipe(
  //             RxJS.filter((_) => this._safeMode === true),
  //             RxJS.tap((request) => this._logger.warn(`airdrop request to blockchain service in safe mode rejected, id: ${request.id.toString()}`)),
  //             RxJS.mergeMap((request) => {
  //               this._eventEmitter.emit(EventType.ERROR_EVENT, new BlockchainError('blockchain module safe mode enabled', {code: ErrorCode.SAFE_MODE, id: request.id}))
  //               return RxJS.EMPTY
  //             }),
  //           ),
  //           RxJS.of(airdropReq).pipe(
  //             RxJS.filter((_) => !this._safeMode),
  //             RxJS.identity
  //           )
  //         )
  //       ),
  //       RxJS.mergeMap((airdropReq: AirdropRequestDto) =>
  //         RxJS.merge(
  //           RxJS.of(airdropReq).pipe(
  //             RxJS.filter(request => request.tokenType !== TokenType.LIV),
  //             RxJS.tap((request) => this._logger.warn(`airdrop token request not supported, id: ${request.id.toString()}`)),
  //             RxJS.mergeMap((request) => {
  //               this._eventEmitter.emit(EventType.ERROR_EVENT, new BlockchainError('Invalid Airdrop Token Request', {code: ErrorCode.INVALID_REQUEST, id: request.id}))
  //               return RxJS.EMPTY
  //             })
  //           ),
  //           RxJS.of(airdropReq).pipe(
  //             RxJS.filter(request => request.tokenType === TokenType.LIV),
  //             RxJS.identity
  //           )
  //         )
  //       ),
  //       RxJS.concatMap((airdropReq:AirdropRequestDto) =>
  //         RxJS.from(airdropReq.data).pipe(
  //           RxJS.map((data) => (<IERC20Extra.BatchTransferRequestStruct>{to: data.destination, amount: BigNumber.from(data.amount)})),
  //           RxJS.toArray(),
  //           RxJS.map((batchTransfers) => [airdropReq, batchTransfers])
  //         )
  //       ),
  //       RxJS.concatMap(([airdropReq, batchTransfers]) =>
  //         RxJS.of([airdropReq, batchTransfers]).pipe(
  //           RxJS.filter((_) => !this._safeMode),
  //           // send tx to blockchain
  //           RxJS.switchMap(([airdropReq, batchTransfers]:[AirdropRequestDto, IERC20Extra.BatchTransferRequestStruct[]]) =>
  //             RxJS.defer(() => RxJS.from(this._livelyToken.connect(this._airdropAccount).batchTransfer(batchTransfers))).pipe(
  //               RxJS.concatMap( (airdropTx: ContractTransaction) =>
  //                 RxJS.of(airdropTx).pipe(
  //                   RxJS.map(tx => {
  //                     let blockchainTx = new BlockchainTxEntity();
  //                     blockchainTx.txHash = tx.hash;
  //                     blockchainTx.txType = tx.type === 0 ? TxType.LEGACY : TxType.DEFAULT;
  //                     blockchainTx.from = tx.from;
  //                     blockchainTx.to = tx.to;
  //                     blockchainTx.nonce = tx.nonce;
  //                     blockchainTx.gasLimit = tx?.gasLimit?.toBigInt();
  //                     blockchainTx.gasPrice = tx?.gasPrice?.toBigInt() ? tx.gasPrice.toBigInt() : 0n;
  //                     blockchainTx.maxFeePerGas = tx?.maxFeePerGas?.toBigInt();
  //                     blockchainTx.maxPriorityFeePerGas = tx?.maxPriorityFeePerGas?.toBigInt();
  //                     blockchainTx.data = tx.data;
  //                     blockchainTx.value = tx.value.toBigInt();
  //                     blockchainTx.networkChainId = this._jsonRpcProvider.network.chainId;
  //                     blockchainTx.networkName = this._jsonRpcProvider.network.name;
  //                     blockchainTx.blockNumber = null;
  //                     blockchainTx.blockHash = null;
  //                     blockchainTx.gasUsed = null;
  //                     blockchainTx.effectiveGasPrice = null;
  //                     blockchainTx.isByzantium = null;
  //                     blockchainTx.failInfo = null;
  //                     blockchainTx.status = TxStatus.PENDING;
  //                     return blockchainTx;
  //                   }),
  //                   RxJS.switchMap((blockchainTxEntity: BlockchainTxEntity) =>
  //                     RxJS.of(blockchainTxEntity).pipe(
  //                       RxJS.mergeMap((blockchainTx) =>
  //                         RxJS.from(this._entityManager.createQueryBuilder()
  //                           .insert()
  //                           .into(BlockchainTxEntity)
  //                           .values([blockchainTx])
  //                           .execute()
  //                         ).pipe(
  //                           RxJS.tap({
  //                             next: (_) => this._logger.log(`save blockchainTxEntity success, id: ${blockchainTx.id}, txHash: ${blockchainTx.txHash}`),
  //                             error: err => this._logger.error(`save blockchainTxEntity failed, txHash: ${blockchainTx.txHash}\n${err.stack}`)
  //                           }),
  //                           RxJS.map((_) => [airdropReq, airdropTx, blockchainTx]),
  //                         )
  //                       ),
  //                       RxJS.catchError((error) =>
  //                         RxJS.merge(
  //                           RxJS.of(error).pipe(
  //                             RxJS.filter(err => err instanceof TypeORMError),
  //                             RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.SAFE_MODE, id: airdropReq.id})),
  //                             RxJS.tap({
  //                               next: (error) => {
  //                                 this._safeMode = true;
  //                                 this._logger.warn(`blockchain service safe mode activated . . .`),
  //                                   this._eventEmitter.emit(EventType.ERROR_EVENT, error)
  //                               },
  //                               error: RxJS.noop,
  //                               complete: RxJS.noop,
  //                             }),
  //                           ),
  //                           RxJS.of(error).pipe(
  //                             RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
  //                             RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.NODE_JS_ERROR, id: airdropReq.id})),
  //                             RxJS.tap((error) => this._eventEmitter.emit(EventType.ERROR_EVENT, error)),
  //                           ),
  //                           RxJS.of(error).pipe(
  //                             RxJS.filter(err => !(err instanceof Error)),
  //                             RxJS.map(err => new BlockchainError('blockchain service internal error', {cause: err, code: ErrorCode.UNKNOWN_ERROR, id: airdropReq.id})),
  //                             RxJS.tap((error) => this._eventEmitter.emit(EventType.ERROR_EVENT, error)),
  //                           )
  //                         ).pipe(
  //                           RxJS.mergeMap( _ => RxJS.of([airdropReq, airdropTx, null]))
  //                         )
  //                       ),
  //                     )
  //                   )
  //                 )
  //               ),
  //               RxJS.catchError((err) =>
  //                 RxJS.merge(
  //                   RxJS.of(err).pipe(
  //                     // block chain error handling
  //                     RxJS.filter((error) => error instanceof Error && (Object.hasOwn(error, 'event') || Object.hasOwn(error, 'code'))),
  //                     RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", error))),
  //                   ),
  //                   RxJS.of(err).pipe(
  //                     // general error handling
  //                     RxJS.filter((error) => error instanceof Error && !(Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code'))),
  //                     RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("lively token batchTransfer failed", {cause: error, code: ErrorCode.NODE_JS_ERROR})))
  //                   )
  //                 )
  //               ),
  //               RxJS.finalize(() => this._logger.debug(`finalize batchTransfer token call . . . `)),
  //               this.retryWithDelay(30000, 3),
  //               RxJS.tap({
  //                 next: (tuple:[AirdropRequestDto, ContractTransaction, BlockchainTxEntity]) => this._logger.log(`send airdrop tx to blockchain success, token: ${tuple[0].tokenType}, txHash: ${tuple[1].hash}`),
  //                 error: err => this._logger.error(`send airdrop tx to blockchain failed\n${err.stack}\n${err?.cause?.stack}`)
  //               }),
  //             )
  //           ),
  //           RxJS.mergeMap((tuple:[AirdropRequestDto, ContractTransaction, BlockchainTxEntity]) =>
  //             RxJS.of(this._confirmationCount).pipe(
  //               RxJS.switchMap((confirmationCount) =>
  //                 RxJS.from(tuple[1].wait(confirmationCount)).pipe(
  //                   RxJS.mergeMap((airdropReceiptTx) =>
  //                     RxJS.merge(
  //                       RxJS.of(airdropReceiptTx).pipe(
  //                         RxJS.filter((_) => !!!tuple[2]),
  //                         RxJS.tap((airdropReceiptTx) => this._logger.warn(`result airdrop batchTransfer tx but tx doesn't persist, id: ${tuple[0].id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
  //                         RxJS.mergeMap(_ => RxJS.EMPTY)
  //                       ),
  //                       RxJS.of(airdropReceiptTx).pipe(
  //                         RxJS.filter((_) => !!tuple[2]),
  //                         RxJS.tap((airdropReceiptTx) => this._logger.log(`airdrop batchTransfer receipt tx, id: ${tuple[0].id.toString()}, txHash: ${airdropReceiptTx.transactionHash}, status: ${airdropReceiptTx.status}`)),
  //                         RxJS.mergeMap((airdropReceiptTx) =>
  //                           RxJS.of(airdropReceiptTx).pipe(
  //                             RxJS.mergeMap(airdropReceiptTx =>
  //                               RxJS.merge(
  //                                 RxJS.of(airdropReceiptTx).pipe(
  //                                   RxJS.filter(receiptTx => receiptTx.events.length > 0),
  //                                   RxJS.mergeMap(receiptTx =>
  //                                     RxJS.from(receiptTx.events).pipe(
  //                                       RxJS.filter((txEvent: Event) => txEvent.event === 'BatchTransfer' ),
  //                                       RxJS.take(1),
  //                                       RxJS.map(event => [event, receiptTx])
  //                                     )
  //                                   )
  //                                 ),
  //                                 RxJS.of(airdropReceiptTx).pipe(
  //                                   RxJS.filter(receiptTx => !receiptTx.events.length),
  //                                   RxJS.mergeMap(_ => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", {code: ErrorCode.INVALID_TX_RECEIPT})))
  //                                 )
  //                               )
  //                             ),
  //                             RxJS.map(([event, receiptTx]:[Event, ContractReceipt]) => {
  //                               let blockchainTx = tuple[2];
  //                               blockchainTx.blockNumber = receiptTx.blockNumber;
  //                               blockchainTx.blockHash = receiptTx.blockHash;
  //                               blockchainTx.gasUsed = receiptTx.gasUsed.toBigInt();
  //                               blockchainTx.effectiveGasPrice = receiptTx.effectiveGasPrice.toBigInt();
  //                               blockchainTx.isByzantium = receiptTx.byzantium;
  //                               blockchainTx.failInfo = null;
  //                               blockchainTx.status = receiptTx.status === 1 ? TxStatus.SUCCESS : TxStatus.FAILED;
  //                               return [event, blockchainTx];
  //                             }),
  //                             // update blockchainTxEntity
  //                             RxJS.switchMap(([event, blockchainTx]:[Event, BlockchainTxEntity]) =>
  //                               RxJS.of([event, blockchainTx]).pipe(
  //                                 RxJS.mergeMap(([event, blockchainTx]) => RxJS.from(this._entityManager.getRepository(BlockchainTxEntity).save(blockchainTx))),
  //                                 RxJS.tap({
  //                                   next: (updateResult) => this._logger.log(`update blockchainTxEntity success, reqId: ${tuple[0].id.toString()}, txHash: ${updateResult.txHash}, status: ${updateResult.status}, blockchainTxId: ${updateResult.id}`),
  //                                   error: (error) => this._logger.error(`update blockchainTxEntity failed, reqId: ${tuple[0].id.toString()}, txHash: ${blockchainTx.txHash}, blockchainTxId: ${blockchainTx.id}\n${error.stack}`)
  //                                 }),
  //                                 RxJS.map(_ => [event, blockchainTx]),
  //                                 RxJS.catchError((error) =>
  //                                   RxJS.merge(
  //                                     RxJS.of(error).pipe(
  //                                       RxJS.filter(err => err instanceof TypeORMError),
  //                                       RxJS.mergeMap(err => RxJS.of(blockchainTx))
  //                                     ),
  //                                     RxJS.of(error).pipe(
  //                                       RxJS.filter(err => !(err instanceof TypeORMError) && err instanceof Error),
  //                                       RxJS.mergeMap(err => RxJS.throwError(() => new BlockchainError('update blockchainTx failed', {cause: err, code: ErrorCode.NODE_JS_ERROR})))
  //                                     )
  //                                   )
  //                                 )
  //                               )
  //                             ),
  //                           ),
  //                         ),
  //                         RxJS.map(([event, blockchainTxEntity]: [Event, BlockchainTxEntity]) => {
  //                           let response = new AirdropResponseDto();
  //                           response.id = tuple[0].id;
  //                           response.recordId = blockchainTxEntity.id;
  //                           response.tokenType = tuple[0].tokenType;
  //                           response.txHash = blockchainTxEntity.txHash
  //                           response.from = blockchainTxEntity.from;
  //                           response.to = blockchainTxEntity.to;
  //                           response.nonce = blockchainTxEntity.nonce;
  //                           response.networkChainId = this._jsonRpcProvider.network.chainId;
  //                           response.networkName = this._jsonRpcProvider.network.name;
  //                           response.totalAmount = event.args.totalAmount.toBigInt();
  //                           response.status = blockchainTxEntity.status;
  //                           this._eventEmitter.emit(EventType.AIRDROP_RESPONSE_EVENT, response)
  //                           return response;
  //                         }),
  //                         RxJS.tap({
  //                           next: response => this._logger.log(`airdrop tx token completed, reqId: ${response.id.toString()}, txHash: ${response.txHash}, amount: ${response.totalAmount.toString()}, recordId: ${response.recordId}`),
  //                           error: err => {
  //                             this._logger.error(`airdrop tx token failed, txHash: ${airdropReceiptTx.transactionHash}\n${err.stack}\n${err?.cause?.stack}`)
  //                             this._eventEmitter.emit(EventType.ERROR_EVENT, err)
  //                           }
  //                         }),
  //                         RxJS.catchError((_) => RxJS.EMPTY)
  //                       )
  //                     )
  //                   )
  //                 )
  //               ),
  //               RxJS.catchError((err) =>
  //                 RxJS.merge(
  //                   RxJS.of(err).pipe(
  //                     RxJS.filter((error) => error instanceof Error && Object.hasOwn(error, 'event') && Object.hasOwn(error, 'code')),
  //                     RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", error))),
  //                   ),
  //                   RxJS.of(err).pipe(
  //                     RxJS.filter((error) => !(error instanceof BlockchainError) && error instanceof Error),
  //                     RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("airdrop batchTransfer tx failed", { cause: error, code: ErrorCode.NODE_JS_ERROR }))),
  //                   ),
  //                   RxJS.of(err).pipe(
  //                     RxJS.filter((error) => error instanceof BlockchainError),
  //                     RxJS.mergeMap((error) => RxJS.throwError(error)),
  //                   )
  //                 )
  //               ),
  //               RxJS.finalize(() => this._logger.debug(`finalize get tx receipt. . . `)),
  //               this.retryWithDelay(30000, 3),
  //             )
  //           ),
  //         )
  //       ),
  //     )
  //   ).pipe(
  //     RxJS.tap({
  //       next: RxJS.noop,
  //       error: RxJS.noop,
  //       complete: () => this._logger.debug('airdrop request handler completed, again register airdrop request listener')
  //     }),
  //     RxJS.repeat(),
  //     RxJS.catchError(err =>
  //       RxJS.merge(
  //         RxJS.of(err).pipe(
  //           RxJS.filter((error) => error instanceof BlockchainError),
  //           RxJS.mergeMap((error) => RxJS.throwError(error)),
  //         ),
  //         RxJS.of(err).pipe(
  //           RxJS.filter((error) => !(error instanceof BlockchainError) && error instanceof Error),
  //           RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("blockchain airdrop event handler pipeline failed", {cause: error, code: ErrorCode.NODE_JS_ERROR}))),
  //         ),
  //         RxJS.of(err).pipe(
  //           RxJS.filter((error) => !(error instanceof Error)),
  //           RxJS.mergeMap((error) => RxJS.throwError(() => new BlockchainError("blockchain airdrop event handler pipeline failed", {cause: error, code: ErrorCode.UNKNOWN_ERROR}))),
  //         )
  //       ).pipe(
  //         RxJS.tap({
  //           next: RxJS.noop,
  //           error: (err) => this._eventEmitter.emit(EventType.ERROR_EVENT, err),
  //           complete: RxJS.noop,
  //         }),
  //       )
  //     ),
  //     RxJS.retry({
  //       delay: error => RxJS.of(error).pipe(
  //         RxJS.filter(err => err instanceof BlockchainError),
  //         RxJS.tap((err) => this._logger.warn(`recreate airdrop pipeline and register again of event handler\n${err.stack}\n${err?.cause?.stack}`)),
  //         RxJS.identity
  //       )
  //     })
  //   ).subscribe({
  //     next: RxJS.noop,
  //     error: err => this._logger.error(`blockchain airdrop pipeline failed, ${err.stack}\n${err?.cause?.stack}`),
  //     complete: () => this._logger.debug(`blockchain airdrop pipeline completed`),
  //   })
  // }

  public async sendAirdropTx(airdropReq: AirdropRequestDto): Promise<AirdropResponseDto> {
    let promise;
    if(!this._isReady) {
      return new Promise<AirdropResponseDto>((_, reject) => {
        reject(new BlockchainError("blockchain service doesn't ready", {code: ErrorCode.SERVICE_NOT_READY}))
      })
    }

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
          if (err.code === ErrorCode.SAFE_MODE.toString() || err.id === id) {
            this._eventEmitter.off(event, success);
            this._eventEmitter.off(EventType.ERROR_EVENT, fail);
            reject(err);
          // } else if (err.id === id) {
          //   this._eventEmitter.off(event, success);
          //   this._eventEmitter.off(EventType.ERROR_EVENT, fail);
          //   reject(err);
          }
        }

        // this._eventEmitter.off(event, success);
        // this._eventEmitter.off(EventType.ERROR_EVENT, fail);
        // reject(err);
      };

      this._eventEmitter.on(event, success);
      this._eventEmitter.on(EventType.ERROR_EVENT, fail);
    });
  }

  private _getTxGasFee(gasType: GasStationType, extraGasTip: number, networkCongest: number): RxJS.Observable<TxGasFeeInfo> {

    return RxJS.timer(0).pipe(
      RxJS.tap(_ => this._logger.debug(`starting getTxGasFeeFromGasStation . . .`)),
      RxJS.mergeMap(_ =>
        RxJS.from(this._getTxGasFeeFromGasStation(gasType, extraGasTip, networkCongest)).pipe(
          RxJS.mergeMap(txGasFeeInfo =>
            RxJS.merge(
              RxJS.of(txGasFeeInfo).pipe(
                RxJS.filter(gasInfo => gasInfo.maxPriorityFeePerGas.isZero() && gasInfo.maxFeePerGas.isZero()),
                RxJS.tap(_ => this._logger.debug(`starting getTxGasFeeFromNetwork . . .`)),
                RxJS.concatMap(_ => RxJS.from(this._getTxGasFeeFromNetwork(extraGasTip, networkCongest)))
              ),
              RxJS.of(txGasFeeInfo).pipe(
                RxJS.filter(gasInfo => !gasInfo.maxPriorityFeePerGas.isZero() && !gasInfo.maxFeePerGas.isZero()),
                RxJS.identity
              )
            )
          ),
          RxJS.tap(txInfo => this._logger.debug(`final TxGasFeeInfo, maxFeePerGas: ${txInfo.maxFeePerGas}, maxPriorityFeePerGas: ${txInfo.maxPriorityFeePerGas}`)),
        )
      )
    )
  }

  private _getTxGasFeeFromNetwork(extraGasTip: number, networkCongest: number): RxJS.Observable<TxGasFeeInfo> {

    return RxJS.defer(() =>
      RxJS.zip(
        RxJS.from(this._jsonRpcProvider.getBlock("latest")),
        RxJS.from(this._jsonRpcProvider.send("eth_maxPriorityFeePerGas", [])),
        RxJS.from(this._jsonRpcProvider.getFeeData())
      )
    ).pipe(
      RxJS.tap({
        next: (data:[Block, string, FeeData]) =>
          this._logger.debug(`eth_maxPriorityFeePerGas: ${BigNumber.from(data[1])}, baseFeePerGas: ${BigNumber.from(data[0].baseFeePerGas)},\n` +
            `FeeData.maxFeePerGas: ${BigNumber.from(data[2].maxFeePerGas)}, FeeData.maxPriorityFeePerGas: ${BigNumber.from(data[2].maxPriorityFeePerGas)}, FeeData.lastBaseFeePerGas: ${BigNumber.from(data[2].lastBaseFeePerGas)}, FeeData.gasPrice: ${BigNumber.from(data[2].gasPrice)},`),
        error: err => this._logger.warn(`json RPC call failed, provider: ${this._blockchainOptions.config.network.url}, message: ${err.message}, code: ${err.code}`)
      }),
      RxJS.mergeMap((data: [Block, string, FeeData]) =>
        RxJS.merge(
          RxJS.of(data).pipe(
            RxJS.filter(info => !!info[0] && !!info[0].baseFeePerGas && !!info[1]),
            RxJS.map(([block, eth_maxPriorityFeePerGas, _]: [Block, string, FeeData]) => {
              let maxPriorityFeePerGas = BigNumber.from(eth_maxPriorityFeePerGas).add(ethers.utils.parseUnits(extraGasTip + '', 'gwei'));
              let maxFeePerGas = block.baseFeePerGas.add(maxPriorityFeePerGas);
              maxFeePerGas = maxFeePerGas.add(block.baseFeePerGas.mul(networkCongest).div(100));
              return { maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas }
            })
          ),
          RxJS.of(data).pipe(
            RxJS.filter(info => !info[0] || !info[0].baseFeePerGas && !!info[1] && !!info[2]),
            RxJS.map(([_, eth_maxPriorityFeePerGas, feeData]: [Block, string, FeeData]) => {
              let maxPriorityFeePerGas = BigNumber.from(eth_maxPriorityFeePerGas).add(ethers.utils.parseUnits(extraGasTip + '', 'gwei'));
              let maxFeePerGas = feeData.lastBaseFeePerGas.add(maxPriorityFeePerGas);
              maxFeePerGas = maxFeePerGas.add(feeData.lastBaseFeePerGas.mul(networkCongest).div(100));
              return { maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas }
            })
          ),
          RxJS.of(data).pipe(
            RxJS.filter(info => !info[0] || !info[0].baseFeePerGas && !info[1] && !!info[2]),
            RxJS.map(([_, __, feeData]: [Block, string, FeeData]) => {
              let maxPriorityFeePerGas = BigNumber.from(feeData.maxPriorityFeePerGas).add(ethers.utils.parseUnits(extraGasTip + '', 'gwei'));
              let maxFeePerGas = feeData.lastBaseFeePerGas.add(maxPriorityFeePerGas);
              maxFeePerGas = maxFeePerGas.add(feeData.lastBaseFeePerGas.mul(networkCongest).div(100));
              return { maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas }
            })
          ),
          RxJS.of(data).pipe(
            RxJS.filter(info => !info[0] || !info[0].baseFeePerGas && !info[1] && !info[2]),
            RxJS.map((_) => ({ maxFeePerGas: BigNumber.from(0), maxPriorityFeePerGas: BigNumber.from(0)}))
          )
        )
      ),
      RxJS.retry({
        count: 7,
        resetOnSuccess: true,
        delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
          RxJS.mergeMap(([error, retryCount]) =>
            RxJS.merge(
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,count]) => Object.hasOwn(err, 'code') && (err.code == ErrorCode.NETWORK_ERROR || err.code == ErrorCode.NETWORK_TIMEOUT || err.code == ErrorCode.SERVER_ERROR) && count < 7),
                RxJS.tap({
                  error: err => this._logger.warn(`jsonRpcProvider failed, error: ${JSON.stringify(err)}`)
                }),
                RxJS.delay(60000 * retryCount),
                RxJS.tap(([_, retryCount]) => this._logger.warn(`get gasFeeData from jsonRpcProvider failed, retry ${retryCount} . . . `))
              ),
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,count]) => Object.hasOwn(err, 'code') && (err.code == ErrorCode.NETWORK_ERROR || err.code == ErrorCode.NETWORK_TIMEOUT || err.code == ErrorCode.SERVER_ERROR) && count >= 7),
                RxJS.tap((_) => this._logger.warn(`get gasFeeData from jsonRpcProvider network error . . . `)),
                RxJS.mergeMap(([err,_]) => RxJS.throwError(() => err))
              ),
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,_]) => !err?.code && err instanceof Error),
                RxJS.mergeMap(([err,_]) => RxJS.throwError(() => err))
              )
            )
          ),
        )
      }),
      RxJS.tap({
        error: err => this._logger.error(`get gasFee from blockchain node failed, err: ${err.msg}, stack:${err.stack}`, err)
      }),
      RxJS.catchError((_) => RxJS.of({ maxFeePerGas: BigNumber.from(0), maxPriorityFeePerGas: BigNumber.from(0) })),
      RxJS.finalize(() => this._logger.debug(`finalize gasFeeFromNetwork jsonRPC . . .`)),
    )
  }

  private _getTxGasFeeFromGasStation(gasType: GasStationType, extraGasTip: number, networkCongest: number): RxJS.Observable<TxGasFeeInfo> {
    if (!this._blockchainOptions.config.network.gasStationUrl) {
      this._logger.warn(`gasStationUrl is empty . . .`);
      return RxJS.of({ maxFeePerGas: BigNumber.from(0), maxPriorityFeePerGas: BigNumber.from(0) });
    }

    return RxJS.defer(() => this._httpService.get(this._blockchainOptions.config.network.gasStationUrl)).pipe(
      RxJS.tap({
        next: (axiosResponse) => this._logger.debug(`gasStation Response status: ${axiosResponse.status}, data: ${JSON.stringify(axiosResponse.data)}, station: ${this._blockchainOptions.config.network.gasStationUrl}`),
        error: err => this._logger.warn(`httpClient get gasStation failed, station: ${this._blockchainOptions.config.network.gasStationUrl}, message: ${err.message}, code: ${err.code}`)
      }),
      RxJS.map(axiosResponse => JSON.parse(axiosResponse.data)),
      RxJS.mergeMap((gasStationData: GasStationFeeData) =>
        RxJS.merge(
          RxJS.of(gasType).pipe(
            RxJS.filter(gasType => gasType === GasStationType.SAFE_LOW),
            RxJS.map(_ => {
              // let maxPriorityFeePerGas = parseFloat(gasStationData.safeLow.maxPriorityFee) + extraGasTip
              // let maxPriorityFeePerGas = ethers.utils.parseUnits(parseFloat(gasStationData.safeLow.maxPriorityFee).toFixed(9), 'gwei').add(ethers.utils.parseUnits(extraGasTip.toFixed(9), 'gwei'))
              let maxPriorityFeePerGas = parseFloat(gasStationData.safeLow.maxPriorityFee) + extraGasTip
              return {maxPriorityFeePerGas, gasStationData}
            }),
          ),
          RxJS.of(gasType).pipe(
            RxJS.filter(gasType => gasType === GasStationType.STANDARD),
            RxJS.map(_ => {
              // this._logger.debug(`maxPriorityFee 1: ${ethers.utils.formatUnits(gasStationData.standard.maxPriorityFee, 'gwei')}`)
              // this._logger.debug(`maxPriorityFee 2: ${ethers.utils.parseUnits(gasStationData.standard.maxPriorityFee, 'gwei')}`)
              // let maxPriorityFeePerGas = ethers.utils.parseUnits(parseFloat(gasStationData.standard.maxPriorityFee).toFixed(9), 'gwei').add(ethers.utils.parseUnits(extraGasTip.toFixed(9), 'gwei'))
              let maxPriorityFeePerGas = parseFloat(gasStationData.standard.maxPriorityFee) + extraGasTip
              // let maxPriorityFeePerGas = ethers.utils.parseUnits(parseFloat(gasStationData.standard.maxPriorityFee).toFixed(9)).add(ethers.utils.parseUnits(extraGasTip + '', 'gwei'))
              return {maxPriorityFeePerGas, gasStationData}
            }),
          ),
          RxJS.of(gasType).pipe(
            RxJS.filter(gasType => gasType === GasStationType.FAST),
            RxJS.map(_ => {
              // let maxPriorityFeePerGas = parseFloat(gasStationData.fast.maxPriorityFee) + extraGasTip
              // let maxPriorityFeePerGas = ethers.utils.parseUnits(parseFloat(gasStationData.fast.maxPriorityFee).toFixed(9), 'gwei').add(ethers.utils.parseUnits(extraGasTip.toFixed(9), 'gwei'))
              let maxPriorityFeePerGas = parseFloat(gasStationData.fast.maxPriorityFee) + extraGasTip
              return {maxPriorityFeePerGas, gasStationData}
            }),
          )
        )
      ),
      RxJS.map((gasInfo: {maxPriorityFeePerGas: number, gasStationData: GasStationFeeData}) => {
        // let base_fee = ethers.utils.parseUnits(parseFloat(gasInfo.gasStationData.estimatedBaseFee).toFixed(9), 'gwei');
        let base_fee = parseFloat(gasInfo.gasStationData.estimatedBaseFee);
        let max_fee_per_gas = base_fee + gasInfo.maxPriorityFeePerGas

        this._logger.debug(`base_fee: ${base_fee}, maxPriorityFeePerGas: ${gasInfo.maxPriorityFeePerGas}, max_fee_per_gas: ${max_fee_per_gas}`)

        //  In case the network gets (up to networkCongest) more congested
        // max_fee_per_gas = max_fee_per_gas.add(base_fee.mul(networkCongest).div(100));
        max_fee_per_gas += (base_fee * (networkCongest / 100));
        let maxFeePerGas = ethers.utils.parseUnits(max_fee_per_gas.toFixed(9), 'gwei');
        let maxPriorityFeePerGas = ethers.utils.parseUnits(gasInfo.maxPriorityFeePerGas.toFixed(9), 'gwei');
        return { maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas }
      }),
      RxJS.retry({
        count: 7,
        resetOnSuccess: true,
        delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
          RxJS.mergeMap(([error, retryCount]) =>
            RxJS.merge(
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,count]) => err instanceof AxiosError &&
                  (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK ||
                    err.code === AxiosError.ETIMEDOUT || err.code == 'ECONNRESET' || err.code === 'EAI_AGAIN') &&
                  count < 7
                ),
                RxJS.delay(60000 * retryCount),
                RxJS.tap(([_, retryCount]) => this._logger.warn(`get gasFeeData from gasStation network error, retry ${retryCount} . . . `))
              ),
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,count]) => err instanceof AxiosError &&
                  (err.code === AxiosError.ECONNABORTED || err.code === AxiosError.ERR_NETWORK || err.code === AxiosError.ETIMEDOUT || err?.code == 'ECONNRESET' || err.code === 'EAI_AGAIN') &&
                  count >= 7
                ),
                RxJS.tap((_) => this._logger.error(`get gasFeeData from gasStation network error . . .`)),
                RxJS.mergeMap(([err,_]) => RxJS.throwError(() => err))
              ),
              RxJS.of([error, retryCount]).pipe(
                RxJS.filter(([err,_]) => !(err instanceof AxiosError) && err instanceof Error),
                RxJS.mergeMap(([err,_]) => RxJS.throwError(() => err))
              )
            )
          ),
        )
      }),
      RxJS.tap({
        error: (err) => this._logger.error(`get gasFeeData from gasStation failed, error: ${err.message}\n stack: ${err.stack}`, err)
      }),
      RxJS.catchError((_) => RxJS.of({ maxFeePerGas: BigNumber.from(0), maxPriorityFeePerGas: BigNumber.from(0) })),
      RxJS.finalize(() => this._logger.debug(`finalize gasStation httpClient . . .`)),
    )
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

