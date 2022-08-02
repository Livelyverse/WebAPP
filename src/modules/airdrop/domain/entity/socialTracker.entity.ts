import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType } from "./enums";
import { SocialProfileEntity } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialScheduleEntity } from "./SocialSchedule.entity";
import { SocialAirdropEntity } from "./socialAirdrop.entity";


@Entity({ name: 'social_tracker' })
export class SocialTrackerEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  actionType: SocialActionType

  @ManyToOne((type) => SocialScheduleEntity, (schedule) => schedule.tracker, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  schedule: SocialScheduleEntity

  @ManyToOne((type) => SocialProfileEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialUser: SocialProfileEntity

  @OneToOne(() => SocialAirdropEntity, (airdrop) => airdrop.tracker)
  airdrop: SocialAirdropEntity

  @Column({ type: 'timestamptz', nullable: false })
  submittedAt: Date
}
