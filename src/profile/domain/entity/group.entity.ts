import { BaseEntity } from './base.entity';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { RoleEntity } from './role.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'group' })
export class GroupEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 512, unique: false, nullable: true })
  description: string;

  @ManyToOne((type) => RoleEntity, (role) => role.groups, {
    cascade: false,
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'delete',
  })
  role: RoleEntity;

  @OneToMany((type) => UserEntity, (user) => user.group, {
    cascade: ['insert', 'update', 'soft-remove'],
    onDelete: 'CASCADE',
    lazy: true,
    nullable: true,
  })
  users: Promise<Array<UserEntity>>;
}
