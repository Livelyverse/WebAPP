import { ApiResponseProperty } from "@nestjs/swagger";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialLivelyEntity } from "../entity/socialLively.entity";
import { SocialLivelyViewDto } from "./socialLivelyView.dto";
import { SocialAirdropEntity } from "../entity/socialAirdrop.entity";
import { AirdropRuleViewDto } from "./airdropRuleView.dto";
import { SocialAirdropRuleEntity } from "../entity/socialAirdropRule.entity";
import { AirdropInfoViewDto } from "./airdropInfoView.dto";
import { SocialFollowerEntity } from "../entity/socialFollower.entity";
import { FollowerViewDto } from "./followerView.dto";
import { SocialAirdropUserView } from "../../services/airdrop.service";
import { AirdropUserViewDto } from "./airdropUserView.dto";

export class FindAllAirdropUserViewDto {

  public static from(
    page: number,
    offset: number,
    totalCount: number,
    totalPage: number,
    views: SocialAirdropUserView[],
  ): FindAllAirdropUserViewDto | null {
    const findAllDto = new FindAllAirdropUserViewDto();
    findAllDto.page = page;
    findAllDto.offset = offset;
    findAllDto.totalCount = totalCount;
    findAllDto.totalPage = totalPage;

    if (views) {
      findAllDto.data = views.map(view => AirdropUserViewDto.from(view))
        .reduce((acc, view) => [...acc, view], []);
      return findAllDto;
    }
    return null
  }

  @ApiResponseProperty()
  public page: number;

  @ApiResponseProperty()
  public offset: number;

  @ApiResponseProperty()
  public totalPage: number;

  @ApiResponseProperty()
  public totalCount: number;

  @ApiResponseProperty()
  public data: AirdropUserViewDto[];
}