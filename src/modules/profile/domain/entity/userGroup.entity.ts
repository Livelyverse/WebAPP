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

  static from(entity: UserGroupEntity): UserGroupEntity | null {
    if(entity) {
      const userGroup = new UserGroupEntity();
      userGroup.id = entity?.id;
      userGroup.name = entity?.name;
      userGroup.description = entity?.description;
      userGroup.role = RoleEntity.from(entity?.role);
      userGroup.version = entity?.version;
      userGroup.isActive = entity?.isActive;
      userGroup.isUpdatable = entity?.isUpdatable;
      userGroup.createdAt = typeof entity.createdAt === 'string' ? new Date(entity.createdAt) : entity.createdAt;
      userGroup.updatedAt = typeof entity.updatedAt === 'string' ? new Date(entity.updatedAt) : entity.updatedAt;
      userGroup.deletedAt = typeof entity?.deletedAt === 'string' ? new Date(entity.deletedAt) : entity?.deletedAt;
      return userGroup;
    }
    return null;
  }
}
