import { Column, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialEventEntity } from "./socialEvent.entity";
import { SocialKind } from "./enums";

@Entity({ name: 'social_media' })
export class SocialMediaEntity extends BaseEntity {

  @Column({ type: 'enum', enum: SocialKind, nullable: false})
  socialType: SocialKind

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  profileName?: string

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  account: string

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  url: string

  @Column({ type: 'integer', unique: false, nullable: false })
  followers: number

  @OneToMany((type) => SocialEventEntity, (socialMedia) => socialMedia.social, {
    nullable: true,
  })
  events: Promise<Array<SocialEventEntity>>


}