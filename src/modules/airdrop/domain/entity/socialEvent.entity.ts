import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { ContentDto } from "../dto/content.dto";
import { SocialMediaEntity } from "./socialMedia.entity";
import { SocialTrackerEntity } from "./socialTracker.entity";

@Entity({ name: 'social_event' })
export class SocialEventEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 128, unique: false, nullable: false })
  authorId: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  authorName?: string

  // @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  // context: string

  @Column({ type: 'varchar', length: 32, unique: false, nullable: false })
  lang: string

  @Column({ type: 'varchar', length: 128, unique: false, nullable: false })
  contentId: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  contentUrl: string

  @Column({ type: 'jsonb', unique: false, nullable: false })
  content?: ContentDto

  @Column({ type: 'timestamptz', unique: false, nullable: true })
  submittedAt: Date

  @ManyToOne((type) => SocialMediaEntity, (social) => social.events, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  social: SocialMediaEntity

  @OneToMany((type) => SocialTrackerEntity, (socialTracker) => socialTracker.event, {
    nullable: true,
  })
  observes: Promise<Array<SocialTrackerEntity>>

  @Column({ type: 'timestamptz', nullable: false })
  trackingStartedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  trackingEndAt?: Date

  @Column({ type: 'integer', unique: false, nullable: false })
  trackingInterval: number

}