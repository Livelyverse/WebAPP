import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyEntity } from "./socialLively.entity";

export class AirdropHashtagsValueObject {
  public airdrop: string;
  public join?: string;
  public comment?: string;
}

@Entity({ name: 'social_airdrop_schedule' })
export class SocialAirdropScheduleEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 128, unique: false, nullable: false })
  airdropName: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  description: string

  @Column({ type: 'jsonb', unique: false, nullable: false })
  hashtags: AirdropHashtagsValueObject;

  @Column({ type: 'timestamptz', nullable: false })
  airdropStartAt: Date

  @Column({ type: 'timestamptz', nullable: false })
  airdropEndAt: Date

  @ManyToOne((type) => SocialLivelyEntity, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({name:"socialLivelyId"})
  socialLively: SocialLivelyEntity
}
