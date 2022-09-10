import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";

@Entity({ name: 'social_lively' })
export class SocialLivelyEntity extends BaseEntity {

  @Column({ type: 'text', nullable: false})
  socialType: SocialType

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  userId?: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  username: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  profileName?: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  profileUrl?: string
}