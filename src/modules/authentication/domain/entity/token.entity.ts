import { Column, Entity, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../profile/domain/entity/base.entity';
import { UserEntity } from '../../../profile/domain/entity/user.entity';

@Entity({ name: 'token' })
export class TokenEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 512, unique: false, nullable: false })
  refreshTokenId: string;

  @Column({ unique: false, nullable: false, default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  refreshTokenExpiredAt: Date;

  @OneToOne((type) => UserEntity, (user) => user.token, {})
  user: UserEntity;
}
