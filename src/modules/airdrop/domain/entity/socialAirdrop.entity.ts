import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialTrackerEntity } from "./socialTracker.entity";
import { UnitType } from "./enums";
import { SocialAirdropRuleEntity } from "./socialAirdropRule.entity";
import { NetworkTxEntity } from "../../../blockchain/entity/networkTx.entity";

@Entity({ name: 'social_airdrop' })
export class SocialAirdropEntity extends BaseEntity {

  @ManyToOne((type) => SocialAirdropRuleEntity,
    {
      cascade: ['soft-remove'],
      onDelete: 'NO ACTION',
      nullable: false,
      lazy: false,
      eager: true,
      orphanedRowAction: 'nullify',
    })
  airdropRule: SocialAirdropRuleEntity

  @OneToOne((type) => SocialTrackerEntity,
    (socialTracker) => socialTracker.airdrop,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  tracker: SocialTrackerEntity

  @OneToOne((type) => NetworkTxEntity,{
      cascade: ['soft-remove'],
      onDelete: 'NO ACTION',
      nullable: false,
      lazy: false,
      eager: true,
      orphanedRowAction: 'nullify',
    })
  txRecord: NetworkTxEntity
}
