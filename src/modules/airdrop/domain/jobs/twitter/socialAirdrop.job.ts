import { Injectable, Logger } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as RxJS from "rxjs";
import { SocialLivelyEntity } from "../../entity/socialLively.entity";
import { UserEntity } from "../../../../profile/domain/entity";
import { SocialActionType } from "../../entity/enums";
import { SocialAirdropEntity } from "../../entity/socialAirdrop.entity";

@Injectable()
export class SocialAirdropJob {
  private readonly _logger = new Logger(SocialAirdropJob.name);

  constructor(
    @InjectEntityManager()
    private readonly _entityManager: EntityManager,
    private readonly _configService: ConfigService,
  ) {
    this.airdropTokens()
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  airdropTokens() {
    let airdropQueryResultObservable = RxJS.from(this._entityManager.createQueryBuilder(UserEntity, "users")
      .select('"users"."username" as "username", "users"."walletAddress" as "walletAddress"')
      .addSelect('"airdropRule"."actionType" as "actionType", "airdropRule"."unit" "token"')
      .addSelect('"airdropRule"."amount" as "amount", "airdropRule"."decimal" "decimal"')
      .addSelect('"airdrop".*')
      .innerJoin("social_profile", "socialProfile", '"socialProfile"."userId" = "users"."id"')
      .innerJoin("social_tracker", "socialTracker", '"socialTracker"."socialProfileId" = "socialProfile"."id"')
      .innerJoin("social_airdrop", "airdrop", '"airdrop"."trackerId" = "socialTracker"."id"')
      .innerJoin("social_airdrop_rule", "airdropRule", '"airdropRule"."id" = "airdrop"."airdropRuleId"')
      .where('"airdrop"."networkTxId" IS NULL')
      .getRawMany())
      .pipe(
        RxJS.tap((queryResult) => this._logger.log(`fetch LVL token airdrops, count: ${queryResult.length}`)),
        RxJS.mergeMap((queryResult) =>  {
          let data = []
          queryResult.forEach(value => {
            let {username, walletAddress, actionType, token, amount, decimal, ...airdrop} = value;
            data.push({username, walletAddress, actionType, token, amount, decimal, airdrop})
          })
          return RxJS.from(data);
        }),
      )

    RxJS.from(airdropQueryResultObservable).pipe(
      RxJS.groupBy((data) => data.username),
      RxJS.mergeMap(group => group.pipe(RxJS.toArray())),
      RxJS.mergeMap(data =>
        RxJS.from(data).pipe(
          RxJS.reduce((acc, value) => acc + BigInt(value.amount), 0n),
          RxJS.map((total) => ({data, total: total.toString()}))
        )
      ),
      RxJS.bufferCount(32)
    ).subscribe({
      next: (value) => this._logger.log(`received data value: ${JSON.stringify(value, null, 2)}`)
    })
  }

  // groupBy <T>(array: T[], predicate: (value: T, index: number, array: T[]) => string) {
  //   array.reduce((acc, value, index, array) => {
  //     (acc[predicate(value, index, array)] ||= []).push(value);
  //     return acc;
  //   }, {} as { [key: string]: T[] });
  // }
}