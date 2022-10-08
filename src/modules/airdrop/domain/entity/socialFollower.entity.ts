import { Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialProfileEntity } from "../../../profile/domain/entity";
import { SocialTrackerEntity } from "./socialTracker.entity";

@Entity({ name: 'social_follower' })
export class SocialFollowerEntity extends BaseEntity {
  @ManyToOne((type) => SocialProfileEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({name:"socialProfileId"})
  socialProfile: SocialProfileEntity

  @ManyToOne((type) => SocialLivelyEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({name:"socialLivelyId"})
  socialLively: SocialLivelyEntity

  @OneToOne(() =>SocialTrackerEntity, (socialTracker) => socialTracker.follower)
  socialTracker?: SocialTrackerEntity
}