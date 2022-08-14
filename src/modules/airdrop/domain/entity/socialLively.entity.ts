import { Column, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialEventEntity } from "./socialEvent.entity";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";

@Entity({ name: 'social_lively' })
export class SocialLivelyEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  socialType: SocialType

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  userId: string

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  username: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  profileName?: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  profileUrl: string

  @OneToMany((type) => SocialEventEntity, (socialEvent) => socialEvent.social, {
    nullable: true,
  })
  events?: Promise<Array<SocialEventEntity>>
}