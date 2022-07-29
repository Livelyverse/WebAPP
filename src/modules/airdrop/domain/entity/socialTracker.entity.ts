import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType } from "./enums";
import { SocialMediaEntity } from "../../../profile/domain/entity/socialMedia.entity";
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

  @ManyToOne((type) => SocialMediaEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialUser: SocialMediaEntity

  @OneToOne(() => SocialAirdropEntity, (airdrop) => airdrop.tracker)
  airdrop: SocialAirdropEntity

  @Column({ type: 'timestamptz', nullable: false })
  submittedAt: Date
}
