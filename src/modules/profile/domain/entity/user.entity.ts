import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from './base.entity';
import { UserGroupEntity } from './userGroup.entity';

@Entity({ name: 'user' })
export class UserEntity extends BaseEntity {
  
  @Column({ type: 'varchar', length: 256, unique: true, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  fullName: string;

  // @Column({ type: 'varchar', length: 128, unique: false, nullable: true })
  // lastname: string;

  @Column({ type: 'boolean', default: false })
  isEmailConfirmed: boolean;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: false })
  password: string;

  @Column({ type: 'varchar', length: 1024, unique: false, nullable: true })
  imageUrl: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: true })
  imageFilename: string;

  @Column({ type: 'varchar', length: 32, unique: false, nullable: true })
  imageMimeType: string;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: true })
  walletAddress: string;

  @ManyToOne((type) => UserGroupEntity, {
    cascade: ['soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({ name: 'userGroupId' })
  userGroup: UserGroupEntity;

  static from(entity: UserEntity): UserEntity | null {
    if(entity) {
      const user = new UserEntity();
      user.id = entity?.id;
      user.email = entity?.email;
      user.fullName = entity?.fullName;
      user.walletAddress = entity?.walletAddress;
      user.password = entity?.password;
      user.isEmailConfirmed = entity?.isEmailConfirmed;
      user.imageUrl = entity.imageUrl;
      user.imageFilename = entity.imageFilename;
      user.imageMimeType = entity.imageMimeType;
      user.userGroup = UserGroupEntity.from(entity?.userGroup);
      user.version = entity?.version;
      user.isActive = entity?.isActive;
      user.isUpdatable = entity?.isUpdatable;
      user.createdAt = typeof entity.createdAt === 'string' ? new Date(entity.createdAt) : entity.createdAt;
      user.updatedAt = typeof entity.updatedAt === 'string' ? new Date(entity.updatedAt) : entity.updatedAt;
      user.deletedAt = typeof entity?.deletedAt === 'string' ? new Date(entity.deletedAt) : entity?.deletedAt;
      return user;
    }
    return null;
  }
}
