import { Injectable, Logger } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { UserEntity } from "../../../profile/domain/entity";
import { BlockchainService } from "../../../blockchain/blockchain.service";
import { AirdropRequestDto, TokenType } from "../../../blockchain/domain/dto/airdropRequest.dto";
import { SocialAirdropEntity } from "../entity/socialAirdrop.entity";
import { BlockchainTxEntity } from "../../../blockchain/domain/entity/blockchainTx.entity";
import { BlockchainError, ErrorCode } from "../../../blockchain/domain/error/blockchainError";

@Injectable()
export class SocialAirdropJob {
  private readonly _logger = new Logger(SocialAirdropJob.name);
  private readonly _bufferCount: number;
  private _safeMode = false;
  private _isRunning = false;

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    private readonly _configService: ConfigService,
    private readonly _blockchainService: BlockchainService,
  ) {
    this._bufferCount = this._configService.get<number>('airdrop.bufferCount');
    this.airdropTokens()
  }

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  airdropTokens() {
    if(!this._isRunning) {
      this._isRunning = true;
    } else {
      this._logger.warn("airdropTokens is already running . . .");
      return;
    }

    let airdropQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(UserEntity, "users")
      .select('"users"."email" as "email", "users"."walletAddress" as "walletAddress"')
      .addSelect('"socialProfile"."username" as "socialUsername", "socialProfile"."socialType" as "socialType"')
      .addSelect('"airdropRule"."actionType" as "actionType", "airdropRule"."unit" "token"')
      .addSelect('"airdropRule"."amount" as "amount", "airdropRule"."decimal" "decimal"')
      .addSelect('"airdrop".*')
      .innerJoin("social_profile", "socialProfile", '"socialProfile"."userId" = "users"."id"')
      .innerJoin("social_tracker", "socialTracker", '"socialTracker"."socialProfileId" = "socialProfile"."id"')
      .innerJoin("social_airdrop", "airdrop", '"airdrop"."socialTrackerId" = "socialTracker"."id"')
      .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
      .where('"airdrop"."blockchainTxId" IS NULL')
      .andWhere('"users"."walletAddress" IS NOT NULL')
      .getRawMany()).pipe(
        RxJS.tap({
          next: (queryResult) => this._logger.log(`fetch LIV token airdrops, count: ${queryResult.length}`),
          error: err => this._logger.error(`fetch LIV token airdrops failed`, err)
        }),
        RxJS.mergeMap((queryResult) =>
          RxJS.from(queryResult).pipe(
            RxJS.map(value => {
              let {email, walletAddress, socialUsername, socialType, actionType, token, amount, decimal, ...airdrop} = value;
              return {email, walletAddress, socialUsername, socialType, actionType, token, amount, decimal, airdrop};
            }),
          )
        ),
        RxJS.catchError(err => RxJS.of(err).pipe(RxJS.mergeMap(_ => RxJS.EMPTY)))
      )

    this._logger.debug("airdrop tokens job starting . . . ");

    RxJS.merge(
      RxJS.of(this._safeMode).pipe(
        RxJS.filter(safeMode => safeMode),
        RxJS.tap(_ => this._logger.warn(`socialAirdrop job safeMode enabled . . .`)),
        RxJS.mergeMap(_ => RxJS.EMPTY)
      ),
      RxJS.of(this._safeMode).pipe(
        RxJS.filter(safeMode => !safeMode),
        RxJS.mergeMap(_ =>
          RxJS.from(airdropQueryResultObservable).pipe(
            RxJS.groupBy((data) => data.email),
            RxJS.mergeMap(group => group.pipe(RxJS.toArray())),
            // RxJS.mergeMap(userDataArray =>
            //   RxJS.from(userDataArray).pipe(
            //     RxJS.groupBy(data => data.socialType),
            //     RxJS.mergeMap(group => group.pipe(RxJS.toArray()))
            //   )
            // ),
            RxJS.mergeMap(userAirdrops =>
              RxJS.from(userAirdrops).pipe(
                RxJS.reduce((acc, airdrop) => acc + BigInt(airdrop.amount), 0n),
                RxJS.map((total) => ({userAirdrops, total}))
              )
            ),
            RxJS.tap(data => {
              const airdropIds = data.userAirdrops.map(userAirdrop => userAirdrop.airdrop.id).reduce((acc, value) => [...acc, value], [])
              const userAirdrop = data.userAirdrops[0]
              this._logger.log(`airdropInfo, email: ${userAirdrop.email}, walletAddress: ${userAirdrop.walletAddress},`+
                               `socialUsername: ${userAirdrop.socialUsername}, socialType: ${userAirdrop.socialType},`+
                               `actionType: ${userAirdrop.actionType}, totalAmount: ${data.total.toString()}, airdropIds: ${JSON.stringify(airdropIds)}`)
            }),
            RxJS.bufferCount(this._bufferCount),
            RxJS.concatMap(buffers =>
              RxJS.from(buffers).pipe(
                RxJS.reduce((acc, buffer) => {
                    acc['data'].push({ destination: buffer.userAirdrops[0].walletAddress,
                      amount: BigInt(buffer.total) * (10n ** BigInt(buffer.userAirdrops[0].decimal))})
                    return acc;
                  },
                  AirdropRequestDto.from(Symbol.for('AirdropRequestId'), TokenType.LIV)
                ),
                RxJS.concatMap((airdropRequest) =>
                  RxJS.defer( () => RxJS.from(this._blockchainService.sendAirdropTx(<AirdropRequestDto><unknown>airdropRequest))).pipe(
                    RxJS.catchError(error =>
                      RxJS.merge(
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof BlockchainError && err.code === ErrorCode.NETWORK_ERROR),
                          RxJS.mergeMap((err) => RxJS.throwError(err)),
                        ),
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof BlockchainError && err.code !== ErrorCode.NETWORK_ERROR),
                          RxJS.tap({
                            next: err => {
                              this._safeMode = true
                              this._logger.warn(`airdrop request in blockchain service failed, error: ${err?.message}`)
                              this._logger.warn(`social airdrop safe mode enabled`)
                            },
                          }),
                          RxJS.catchError(err => RxJS.EMPTY)
                        ),
                        RxJS.of(error).pipe(
                          RxJS.filter(err => err instanceof Error && !(err instanceof BlockchainError)),
                          RxJS.tap({
                            next: err => {
                              this._safeMode = true
                              this._logger.error(`airdrop request failed`, err)
                              this._logger.warn(`social airdrop safe mode enabled`)
                            },
                          }),
                          RxJS.catchError(err => RxJS.EMPTY)
                        )
                      )
                    ),
                    RxJS.finalize(() => this._logger.debug(`finalize blockchainService.sendAirdropTx . . . `)),
                    RxJS.retry({
                      count:3,
                      delay: (error, retryCount) => RxJS.of([error, retryCount]).pipe(
                        RxJS.mergeMap(([error, retryCount]) =>
                          RxJS.merge(
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code == ErrorCode.NETWORK_ERROR && count <= 3),
                              RxJS.delay(30000)
                            ),
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err,count]) => err instanceof BlockchainError && err.code == ErrorCode.NETWORK_ERROR && count > 3),
                              RxJS.mergeMap(([err,_]) => RxJS.throwError(err))
                            ),
                            RxJS.of([error, retryCount]).pipe(
                              RxJS.filter(([err,_]) => !(err instanceof BlockchainError)),
                              RxJS.mergeMap(([err,_]) => RxJS.throwError(err)),
                            )
                          )
                        ),
                        RxJS.tap(([_, retryCount]) => this._logger.warn(`airdrop request failed, retry ${retryCount} . . . `))
                      )
                    })
                  )
                ),
                RxJS.concatMap(airdropResponse =>
                  RxJS.from(buffers).pipe(
                    RxJS.mergeMap(buffer =>
                      RxJS.from(buffer.userAirdrops).pipe(
                        RxJS.map((userAirdrop) => {
                          let blockchainTx = new BlockchainTxEntity();
                          blockchainTx.id = airdropResponse.recordId;
                          userAirdrop.airdrop.blockchainTx = blockchainTx;
                          return userAirdrop.airdrop;
                        }),
                        RxJS.toArray()
                      )
                    ),
                    RxJS.concatMap(airdrops =>
                      RxJS.from(this._entityManager.getRepository(SocialAirdropEntity).save(airdrops)).pipe(
                        RxJS.tap({
                          next: airdrops => {
                            let airdropIds = airdrops.map(airdrop => airdrop.id).reduce((acc, airdrop) => [...acc, airdrop], [])
                            this._logger.log(`airdrop updates success with blockchainTxId: ${airdrops[0].blockchainTx.id}, airdropIds: ${airdropIds}`)
                          },
                          error: err => {
                            this._safeMode = true
                            let airdropIds = airdrops.map(airdrop => airdrop.id).reduce((acc, airdrop) => [...acc, airdrop], [])
                            this._logger.error(`airdrop updates failed for blockchainTxId: ${airdrops[0].blockchainTx.id}, airdropIds: ${airdropIds}\ncause:${err?.cause?.stack}`, err)
                          }
                        }),
                        RxJS.catchError(err => RxJS.EMPTY)
                      )
                    )
                  )
                ),
              )
            ),
          )
        )
      )
    ).subscribe({
      next: RxJS.noop,
      error: err => {
        this._logger.error(`airdropToken job failed`, err);
        this._isRunning = false;
      },
      complete: () => {
        this._logger.debug(`airdropToken job completed`);
        this._isRunning = false;
      },
    })
  }
}