import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { UserEntity } from "./user.entity";

export enum SocialType {
  TWITTER = "TWITTER",
  INSTAGRAM = "INSTAGRAM",
  TIKTOK = "TIKTOK",
  TELEGRAM = "TELEGRAM",
  DISCORD = "DISCORD",
}

@Entity({ name: 'social_media' })
export class SocialMediaEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  username: string

  @Column({ type: 'text', nullable: false})
  socialType: SocialType

  @Column({ type: 'varchar', length: 256, unique: true, nullable: true })
  profileName?: string

  @Column({ type: 'varchar', length: 1024, unique: true, nullable: true })
  profileUrl?: string

  @ManyToOne((type) => UserEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  user: UserEntity
}