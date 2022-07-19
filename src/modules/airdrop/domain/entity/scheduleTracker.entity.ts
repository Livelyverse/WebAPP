import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialEventEntity } from "./socialEvent.entity";

@Entity({ name: 'schedule_tracker' })
export class ScheduleTrackerEntity extends BaseEntity {

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
}