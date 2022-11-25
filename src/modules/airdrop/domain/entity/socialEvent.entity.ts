import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { ContentDto } from "../dto/content.dto";
import { SocialLivelyEntity } from "./socialLively.entity";
import { SocialAirdropScheduleEntity } from "./socialAirdropSchedule.entity";

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
  //
  // @Column({ type: 'timestamptz', nullable: false })
  // trackingStartedAt: Date
  //
  // @Column({ type: 'timestamptz', nullable: false })
  // trackingEndAt: Date

  @ManyToOne((type) => SocialAirdropScheduleEntity, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({name:"airdropScheduleId"})
  airdropSchedule: SocialAirdropScheduleEntity;

  // @ManyToOne((type) => SocialLivelyEntity, {
  //   cascade: ['soft-remove'],
  //   onDelete: 'NO ACTION',
  //   nullable: false,
  //   lazy: false,
  //   eager: true,
  //   orphanedRowAction: 'nullify',
  // })
  // @JoinColumn({name:"socialLivelyId"})
  // socialLively: SocialLivelyEntity
}