import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../profile/domain/entity/base.entity';
import { UserEntity } from '../../../profile/domain/entity/user.entity';

@Entity({ name: 'auth_mail' })
export class AuthMailEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  from: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  sendTo: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  verificationId: string;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  expiredAt: Date;

  @Column({ default: false, nullable: false })
  public isConfirmed: boolean;

  @ManyToOne((type) => UserEntity, (user) => user.verifyMails, {
    cascade: ['update', 'soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  user: UserEntity;
}
