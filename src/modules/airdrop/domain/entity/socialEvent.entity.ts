import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { ContentDto } from "../dto/content.dto";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialTrackerEntity } from "./socialTracker.entity";
import { SocialEventType } from "./enums";
import { SocialFollowerEntity } from "./socialFollower.entity";
import { SocialScheduleEntity } from "./SocialSchedule.entity";

@Entity({ name: 'social_event' })
export class SocialEventEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  eventType: SocialEventType

  @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  contentId?: string

  @Column({ type: 'jsonb', unique: false, nullable: true })
  content?: ContentDto

  @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  authorId?: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  authorName?: string

  // @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  // context: string

  @Column({ type: 'varchar', length: 32, unique: false, nullable: true })
  lang?: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  contentUrl?: string

  @Column({ type: 'timestamptz', unique: false, nullable: true })
  publishedAt?: Date

  @Column({ type: 'timestamptz', nullable: false })
  trackingStartedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  trackingEndAt?: Date

  @Column({ type: 'integer', unique: false, nullable: false })
  trackingInterval: number

  @OneToOne((type) => SocialFollowerEntity, (follower) => follower.event, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  follower: SocialFollowerEntity

  @ManyToOne((type) => SocialLivelyEntity, (social) => social.events, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: true,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  social: SocialLivelyEntity

  @OneToMany((type) => SocialScheduleEntity, (scheduleTracker) => scheduleTracker.event, {
    nullable: true,
  })
  schedules: Promise<Array<SocialScheduleEntity>>
}