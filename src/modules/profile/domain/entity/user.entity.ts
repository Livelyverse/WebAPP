import { Entity, Column, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GroupEntity } from './group.entity';
import {
  AuthMailEntity,
  TokenEntity,
} from '../../../authentication/domain/entity';
import { SocialProfileEntity } from "./socialProfile.entity";

@Entity({ name: 'user' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  firstname?: string;

  @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  lastname?: string;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  email: string;

  @Column({ type: 'boolean', default: false })
  public isEmailConfirmed: boolean;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  password: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  imageFilename?: string;

  @Column({ type: 'varchar', length: 32, unique: false, nullable: true })
  imageMimeType?: string;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: true })
  walletAddress?: string;

  @ManyToOne((type) => GroupEntity, (group) => group.users, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  group: GroupEntity;

  @OneToMany((type) => AuthMailEntity, (authMails) => authMails.user)
  authMails: Promise<Array<AuthMailEntity>>;

  @OneToOne((type) => TokenEntity, (token) => token.user)
  token: TokenEntity;
}
