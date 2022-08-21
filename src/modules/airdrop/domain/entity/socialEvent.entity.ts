import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { ContentDto } from "../dto/content.dto";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialTrackerEntity } from "./socialTracker.entity";

@Entity({ name: 'social_event' })
export class SocialEventEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  contentId?: string

  @Column({ type: 'jsonb', unique: false, nullable: false })
  content: ContentDto

  @Column({ type: 'varchar', length: 32, unique: false, nullable: true })
  lang?: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  contentUrl?: string

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  publishedAt: Date

  @Column({ type: 'timestamptz', nullable: false })
  trackingStartedAt: Date

  @Column({ type: 'timestamptz', nullable: false })
  trackingEndAt: Date

  @ManyToOne((type) => SocialLivelyEntity, (social) => social.events, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  socialLively: SocialLivelyEntity

  @OneToMany((type) => SocialTrackerEntity, (socialTracker) => socialTracker.socialEvent, {
    nullable: true,
  })
  socialTracker: Promise<Array<SocialTrackerEntity>>
}