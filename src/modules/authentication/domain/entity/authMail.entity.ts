import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { UserEntity, BaseEntity, UserGroupEntity } from "../../../profile/domain/entity";

export enum AuthMailType {
  USER_VERIFICATION = "USER_VERIFICATION",
  FORGOTTEN_PASSWORD = "FORGOTTEN_PASSWORD",
}

@Entity({ name: 'auth_mail' })
export class AuthMailEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  from: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  sendTo: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  verificationId: string;

  @Column({ type: 'varchar', length: 256, unique: false, nullable: false })
  mailType: AuthMailType;

  @Column({ type: 'timestamptz', unique: false, nullable: false })
  expiredAt: Date;

  @ManyToOne((type) => UserEntity, {
    cascade: ['update', 'soft-remove'],
    onDelete: 'NO ACTION',
    nullable: false,
    lazy: false,
    eager: true,
    orphanedRowAction: 'nullify',
  })
  @JoinColumn({ name: 'userId' })
  public user: UserEntity;

}
