import { ApiResponseProperty } from "@nestjs/swagger";
import { BaseEntity } from "../../../profile/domain/entity";
import { SocialLivelyEntity } from "../entity/socialLively.entity";
import { SocialLivelyViewDto } from "./socialLivelyView.dto";
import { SocialAirdropEntity } from "../entity/socialAirdrop.entity";
import { AirdropRuleViewDto } from "./airdropRuleView.dto";
import { SocialAirdropRuleEntity } from "../entity/socialAirdropRule.entity";

export class FindAllViewDto<K> {

  public static from<T extends BaseEntity>(
    page: number,
    offset: number,
    totalCount: number,
    totalPage: number,
    entities: T[],
  ): FindAllViewDto<unknown> | null {
    const findAllDto = new FindAllViewDto();
    findAllDto.page = page;
    findAllDto.offset = offset;
    findAllDto.totalCount = totalCount;
    findAllDto.totalPage = totalPage;

    if (Array.isArray(entities) && entities[0] instanceof SocialLivelyEntity) {
      findAllDto.data = entities.map(entity => SocialLivelyViewDto.from(<SocialLivelyEntity><unknown>entity))
        .reduce((acc, view) => [...acc, view], []);
      return findAllDto;
    } else if (Array.isArray(entities) && entities[0] instanceof SocialAirdropRuleEntity) {
      findAllDto.data = entities.map(entity => AirdropRuleViewDto.from(<SocialAirdropRuleEntity><unknown>entity))
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
  public data: K[];
}