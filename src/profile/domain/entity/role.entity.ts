import { BaseEntity } from './base.entity';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { GroupEntity } from './group.entity';

@Entity({ name: 'role' })
export class RoleEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 512, unique: false, nullable: true })
  description: string;

  @OneToMany((type) => GroupEntity, (group) => group.role, {
    cascade: ['insert', 'update', 'soft-remove'],
    onDelete: 'CASCADE',
    lazy: true,
    nullable: true,
  })
  groups: Promise<Array<GroupEntity>>;
}
