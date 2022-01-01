import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GroupEntity } from './group.entity';
import { RoleEntity } from './role.entity';

@Entity({ name: 'user' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 128 })
  firstname: string;

  @Column({ type: 'varchar', length: 128 })
  lastname: string;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  email: string;

  @Column({ default: false })
  public isEmailConfirmed: boolean;

  @Column({ nullable: false })
  password: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  imageUrl: string;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: true })
  walletAddress: string;

  @ManyToOne((type) => GroupEntity, (group) => group.users, {
    cascade: false,
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'delete',
  })
  group: GroupEntity;
}
