import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialTrackerEntity } from "./socialTracker.entity";
import { SocialAirdropRuleEntity } from "./socialAirdropRule.entity";
import { BlockchainTxEntity } from "../../../blockchain/domain/entity/blockchainTx.entity";

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
  @JoinColumn({name:"airdropRuleId"})
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
  @JoinColumn({name:"socialTrackerId"})
  tracker: SocialTrackerEntity

  @ManyToOne((type) => BlockchainTxEntity,{
      cascade: ['soft-remove'],
      onDelete: 'NO ACTION',
      nullable: true,
      lazy: false,
      eager: true,
      orphanedRowAction: 'nullify',
  })
  @JoinColumn({name:"blockchainTxId"})
  blockchainTx?: BlockchainTxEntity
}
