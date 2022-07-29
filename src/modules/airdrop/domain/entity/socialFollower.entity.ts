import { Entity, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity, UserEntity } from "../../../profile/domain/entity";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialMediaEntity } from "../../../profile/domain/entity/socialMedia.entity";
import { SocialEventEntity } from "./socialEvent.entity";

@Entity({ name: 'social_follower' })
export class SocialFollowerEntity extends BaseEntity {
  @ManyToOne((type) => SocialMediaEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialMedia: SocialMediaEntity

  @ManyToOne((type) => SocialLivelyEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialLively: SocialLivelyEntity

  @OneToOne(() =>SocialEventEntity, (socialEvent) => socialEvent.follower)
  event: SocialEventEntity
}