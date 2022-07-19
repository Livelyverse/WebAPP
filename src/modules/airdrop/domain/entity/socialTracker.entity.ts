import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity, UserEntity } from "../../../profile/domain/entity";
import { SocialEventEntity } from "./socialEvent.entity";
import { SocialActionType, SocialKind } from "./enums";


@Entity({ name: 'social_tracker' })
export class SocialTrackerEntity extends BaseEntity {

  @Column({ type: 'enum', enum: SocialKind, nullable: false})
  socialType: SocialKind

  @Column({ type: 'enum', enum: SocialActionType, nullable: false})
  actionType: SocialActionType

  @ManyToOne((type) => SocialEventEntity, (socialEvent) => socialEvent.observes, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  event: SocialEventEntity

  @ManyToOne((type) => UserEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  user: UserEntity

  @Column({ type: 'timestamptz', nullable: false })
  submittedAt: Date
}
