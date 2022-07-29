import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialEventEntity } from "./socialEvent.entity";
import { SocialTrackerEntity } from "./socialTracker.entity";

@Entity({ name: 'social_schedule' })
export class SocialScheduleEntity extends BaseEntity {

  @Column({ type: 'timestamptz', nullable: false })
  triggeredAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  nextSchedule?: Date

  @Column({ type: 'boolean', nullable: false })
  isScheduleEnd: boolean

  @ManyToOne((type) => SocialEventEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  event: SocialEventEntity

  @OneToMany(() => SocialTrackerEntity, (tracker) => tracker.schedule)
  tracker: SocialTrackerEntity



}