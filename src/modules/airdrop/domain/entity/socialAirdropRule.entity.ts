import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialActionType, UnitType } from "./enums";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";

@Entity({ name: 'social_airdrop_rule' })
export class SocialAirdropRuleEntity extends BaseEntity {
  @Column({ type: 'text', nullable: false})
  socialType: SocialType

  @Column({ type: 'text', nullable: false})
  actionType: SocialActionType

  @Column({ type: 'text', nullable: false})
  unit: UnitType

  @Column({ type: 'bigint', nullable: false})
  amount: bigint

  @Column({ type: 'integer', nullable: false})
  decimal: number
}
