import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { BaseEntity, UserEntity } from '../../../profile/domain/entity';

@Entity({ name: 'auth_token' })
export class AuthTokenEntity extends BaseEntity {
  @Column({ type: 'boolean', unique: false, nullable: false, default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  refreshTokenExpiredAt: Date;

  @ManyToOne((type) => UserEntity, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn()
  user: UserEntity;
}
