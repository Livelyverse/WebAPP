import { ApiResponseProperty } from "@nestjs/swagger";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { AirdropHashTagsValueObject, SocialAirdropScheduleEntity } from "../entity/socialAirdropSchedule.entity";


export class AirdropScheduleViewDto {

  public static from(entity: SocialAirdropScheduleEntity): AirdropScheduleViewDto | null {
    if(entity) {
      const dto = new AirdropScheduleViewDto();
      dto.id = entity.id;
      dto.socialType = entity.socialLively.socialType;
      dto.airdropName = entity.airdropName;
      dto.description = entity.description;
      dto.hashTags = entity.hashTags;
      dto.airdropStartAt = entity.airdropStartAt;
      dto.airdropEndAt = entity.airdropEndAt;
      dto.createdAt = entity.createdAt;
      dto.updatedAt = entity.updatedAt;
      return dto;
    }
    return null;
  }

  @ApiResponseProperty()
  id: string;

  @ApiResponseProperty()
  socialType: SocialType;

  @ApiResponseProperty()
  airdropName: string;

  @ApiResponseProperty()
  description: string;

  @ApiResponseProperty()
  hashTags: AirdropHashTagsValueObject;

  @ApiResponseProperty()
  airdropStartAt: Date;

  @ApiResponseProperty()
  airdropEndAt: Date;

  @ApiResponseProperty()
  createdAt: Date;

  @ApiResponseProperty()
  updatedAt: Date;
}