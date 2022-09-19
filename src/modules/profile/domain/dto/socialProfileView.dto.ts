import { ApiResponseProperty } from "@nestjs/swagger";
import { SocialProfileEntity, SocialType } from "../entity/socialProfile.entity";

export class SocialProfileViewDto {
  public static from(entity: SocialProfileEntity): SocialProfileViewDto | null  {
    if (entity) {
      let socialProfile = new SocialProfileViewDto();
      socialProfile.id = entity.id;
      socialProfile.socialType = entity.socialType;
      socialProfile.userId = entity.user.id;
      socialProfile.username = entity.username;
      socialProfile.socialName = entity?.socialName;
      socialProfile.profileUrl = entity?.profileUrl;
      socialProfile.website = entity?.website;
      socialProfile.location = entity?.location;
      socialProfile.createdAt = entity.createdAt;
      socialProfile.updatedAt = entity.updatedAt;
      return socialProfile;
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
  socialName?: string

  @ApiResponseProperty()
  profileUrl?: string

  @ApiResponseProperty()
  website?: string

  @ApiResponseProperty()
  location: string

  @ApiResponseProperty()
  createdAt: Date;

  @ApiResponseProperty()
  updatedAt: Date;
}
