import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialTrackerEntity } from "./socialTracker.entity";
import { UnitType } from "./enums";

@Entity({ name: 'social_airdrop' })
export class SocialAirdropEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  txHash: string

  @Column({ type: 'text', nullable: false})
  unit: UnitType

  @Column({ type: 'bigint', unique: false, nullable: false })
  amount: bigint

  @Column({ type: 'timestamptz', nullable: false })
  transferAt: Date

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
}
