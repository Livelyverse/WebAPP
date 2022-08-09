import { Column, Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType } from "./enums";
import { SocialProfileEntity } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialAirdropEntity } from "./socialAirdrop.entity";
import { SocialFollowerEntity } from "./socialFollower.entity";
import { SocialEventEntity } from "./socialEvent.entity";


@Entity({ name: 'social_tracker' })
export class SocialTrackerEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  actionType: SocialActionType

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date

  @ManyToOne((type) => SocialEventEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialEvent: SocialEventEntity

  @ManyToOne((type) => SocialProfileEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialProfile: SocialProfileEntity

  @OneToOne(() => SocialAirdropEntity, (airdrop) => airdrop.tracker)
  airdrop: SocialAirdropEntity

  @OneToOne((type) => SocialFollowerEntity, (follower) => follower.socialTracker, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  follower: SocialFollowerEntity
}
