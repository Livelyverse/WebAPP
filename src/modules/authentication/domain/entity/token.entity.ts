import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity, UserEntity } from '../../../profile/domain/entity';

@Entity({ name: 'token' })
export class TokenEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 512, unique: false, nullable: false })
  refreshTokenId: string;

  @Column({ type: 'boolean', unique: false, nullable: false, default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  refreshTokenExpiredAt: Date;

  @OneToOne((type) => UserEntity, (user) => user.token)
  @JoinColumn()
  user: UserEntity;
}
