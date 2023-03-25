import { ApiResponseProperty } from "@nestjs/swagger";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialAirdropRuleEntity } from "../entity/socialAirdropRule.entity";
import { SocialActionType, UnitType } from "../entity/enums";

export class AirdropRuleViewDto {
  public static from(entity: SocialAirdropRuleEntity): AirdropRuleViewDto | null  {
    if (entity) {
      let airdropRuleDto = new AirdropRuleViewDto();
      airdropRuleDto.id = entity.id;
      airdropRuleDto.socialType = entity.socialType;
      airdropRuleDto.socialAction = entity.actionType;
      airdropRuleDto.unit = entity.unit;
      airdropRuleDto.amount = entity.amount;
      airdropRuleDto.decimal = entity.decimal;
      airdropRuleDto.createdAt = entity.createdAt;
      airdropRuleDto.updatedAt = entity.updatedAt;
      return airdropRuleDto;
    }
    return null;
  }

  @ApiResponseProperty()
  id: string;

  @ApiResponseProperty()
  socialType: SocialType

  @ApiResponseProperty()
  socialAction: SocialActionType

  @ApiResponseProperty()
  unit: UnitType

  @ApiResponseProperty()
  amount: string

  @ApiResponseProperty()
  decimal: number

  @ApiResponseProperty()
  public createdAt: Date;

  @ApiResponseProperty()
  public updatedAt: Date;
}
