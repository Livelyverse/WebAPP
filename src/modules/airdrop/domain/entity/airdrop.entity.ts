import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialTrackerEntity } from "./socialTracker.entity";
import { UnitType } from "./enums";

@Entity({ name: 'airdrop' })
export class AirdropEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  socialAccount: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  walletAddress: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  txHash: string

  @Column({ type: 'enum', enum: UnitType, nullable: false})
  unit: UnitType

  @Column({ type: 'bigint', unique: false, nullable: false })
  amount: bigint

  @Column({ type: 'timestamptz', nullable: false })
  transferAt: Date

  @ManyToOne((type) => SocialTrackerEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  tracker: SocialTrackerEntity

}
