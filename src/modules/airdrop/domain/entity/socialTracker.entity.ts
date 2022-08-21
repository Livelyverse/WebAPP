import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType } from "./enums";
import { SocialProfileEntity } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialAirdropEntity } from "./socialAirdrop.entity";
import { SocialEventEntity } from "./socialEvent.entity";
import { SocialFollowerEntity } from "./socialFollower.entity";


@Entity({ name: 'social_tracker' })
export class SocialTrackerEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  actionType: SocialActionType

  @ManyToOne((type) => SocialEventEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialEvent?: SocialEventEntity

  @ManyToOne((type) => SocialProfileEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialProfile: SocialProfileEntity

  @OneToOne((type) => SocialFollowerEntity, (follower) => follower.socialTracker, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({ name: 'socialFollowerId' })
  follower: SocialFollowerEntity

  @OneToOne(() => SocialAirdropEntity, (airdrop) => airdrop.tracker)
  airdrop?: SocialAirdropEntity
}
