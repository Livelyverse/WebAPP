import { Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialProfileEntity } from "../../../profile/domain/entity/socialProfile.entity";
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
  socialProfile: SocialProfileEntity

  @ManyToOne((type) => SocialLivelyEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialLively: SocialLivelyEntity

  @OneToOne(() =>SocialTrackerEntity, (socialTracker) => socialTracker.follower)
  socialTracker?: SocialTrackerEntity
}