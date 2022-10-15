import { SocialFollowerEntity } from "../entity/socialFollower.entity";
import { ApiResponseProperty } from "@nestjs/swagger";

export class FollowerViewDto {

  static from(entity: SocialFollowerEntity): FollowerViewDto | null {
    if(entity) {
      const followerDto = new FollowerViewDto();
      followerDto.username = entity.socialProfile.user.username;
      followerDto.socialType = entity.socialProfile.socialType.toString();
      followerDto.socialUsername = entity.socialProfile.username;
      followerDto.socialName = entity.socialProfile?.socialName ? entity.socialProfile.socialName : null;
      followerDto.socialId = entity.socialProfile?.socialId ? entity.socialProfile.socialId : null;
      followerDto.profileUrl = entity.socialProfile?.profileUrl ? entity.socialProfile.profileUrl : null;
      followerDto.website = entity.socialProfile?.website ? entity.socialProfile.website : null;
      followerDto.location = entity.socialProfile?.location ? entity.socialProfile.location : null;
      return followerDto;
    }
    return null;
  }

  @ApiResponseProperty()
  username: string;

  @ApiResponseProperty()
  socialType: string

  @ApiResponseProperty()
  socialUsername: string

  @ApiResponseProperty()
  socialName: string

  @ApiResponseProperty()
  socialId: string

  @ApiResponseProperty()
  profileUrl: string

  @ApiResponseProperty()
  website: string

  @ApiResponseProperty()
  location: string
}