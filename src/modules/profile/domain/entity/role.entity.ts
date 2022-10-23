import { BaseEntity } from './base.entity';
import { Column, Entity, } from 'typeorm';

@Entity({ name: 'role' })
export class RoleEntity extends BaseEntity {

  @Column({ type: 'varchar', length: 128, unique: true, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 512, unique: false, nullable: true })
  description: string;

  static from(entity: RoleEntity): RoleEntity | null {
    if(entity) {
      const role = new RoleEntity();
      role.id = entity?.id;
      role.name = entity?.name;
      role.description = entity?.description;
      role.version = entity?.version;
      role.isActive = entity?.isActive;
      role.isUpdatable = entity?.isUpdatable;
      role.createdAt = typeof entity.createdAt === 'string' ? new Date(entity.createdAt) : entity.createdAt;
      role.updatedAt = typeof entity.updatedAt === 'string' ? new Date(entity.updatedAt) : entity.updatedAt;
      role.deletedAt = typeof entity?.deletedAt === 'string' ? new Date(entity.deletedAt) : entity?.deletedAt;
      return role;
    }
    return null;
  }
}
