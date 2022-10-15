import { ApiResponseProperty } from "@nestjs/swagger";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyEntity } from "../entity/socialLively.entity";

export class SocialLivelyViewDto {
  public static from(entity: SocialLivelyEntity): SocialLivelyViewDto | null  {
    if (entity) {
      let livelyDto = new SocialLivelyViewDto();
      livelyDto.id = entity.id;
      livelyDto.socialType = entity.socialType;
      livelyDto.userId = entity?.userId ? entity.userId : null;
      livelyDto.username = entity.username;
      livelyDto.profileName = entity?.profileName ? entity.profileName : null;
      livelyDto.profileUrl = entity?.profileUrl ? entity.profileUrl : null;
      livelyDto.createdAt = entity.createdAt;
      livelyDto.updatedAt = entity.updatedAt;
      return livelyDto;
    }
    return null;
  }

  @ApiResponseProperty()
  id: string;

  @ApiResponseProperty()
  username: string;

  @ApiResponseProperty()
  socialType: SocialType

  @ApiResponseProperty()
  userId: string

  @ApiResponseProperty()
  profileName: string

  @ApiResponseProperty()
  profileUrl: string

  @ApiResponseProperty()
  createdAt: Date;

  @ApiResponseProperty()
  updatedAt: Date;
}
