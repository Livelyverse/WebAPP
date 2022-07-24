import { Column, Entity, ManyToOne } from 'typeorm';
import { UserEntity, BaseEntity } from '../../../profile/domain/entity';

export enum AuthMailType {
  USER_VERIFICATION = 0,
  FORGOTTEN_PASSWORD = 1,
}

@Entity({ name: 'auth_mail' })
export class AuthMailEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  from: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  sendTo: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  verificationId: string;

  @Column({ type: 'enum', enum: AuthMailType, unique: false, nullable: false })
  mailType: AuthMailType;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  expiredAt: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  isEmailSent: boolean;

  @Column({ type: 'timestamptz', unique: false, nullable: true })
  mailSentAt: Date;

  @ManyToOne((type) => UserEntity, (user) => user.authMails, {
    cascade: ['update', 'soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  public user: UserEntity;
}
