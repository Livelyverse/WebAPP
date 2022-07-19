import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType, SocialKind, UnitType } from "./enums";

@Entity({ name: 'airdrop_rule' })
export class AirdropRuleEntity extends BaseEntity {
  @Column({ type: 'enum', enum: SocialKind, nullable: false})
  socialType: SocialKind

  @Column({ type: 'enum', enum: SocialActionType, nullable: false})
  actionType: SocialActionType

  @Column({ type: 'enum', enum: UnitType, nullable: false})
  unit: UnitType

  @Column({ type: 'bigint', nullable: false})
  amount: bigint

  @Column({ type: 'integer', nullable: false})
  decimal: number
}
