import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../profile/domain/entity/base.entity';

@Entity({ name: 'token' })
export class TokenEntity extends BaseEntity {
  @Column({ type: 'uuid', unique: true, nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 512, unique: false, nullable: false })
  refreshTokenId: string;

  @Column({ unique: false, nullable: false, default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  refreshTokenExpires: Date;
}
