import { BaseEntity } from './base.entity';
import { Column, Entity, JoinColumn, ManyToOne, } from "typeorm";
import { RoleEntity } from './role.entity';

@Entity({ name: 'user_group' })
export class UserGroupEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 512, unique: false, nullable: true })
  description: string;

  @ManyToOne((type) => RoleEntity,{
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;

}
