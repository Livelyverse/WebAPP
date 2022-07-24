import { ApiProperty } from '@nestjs/swagger';
import { BlogEntity } from "../entity/blog.entity";
import { MediumRssViewDto } from "./mediumRssView.dto";

export class FindAllViewDto {
  public static from(
    page,
    offset,
    totalCount: number,
    totalPage: number,
    entities: BlogEntity[],
  ): FindAllViewDto | null {
    if (!entities) {
      return null;
    }

    const findAllDto = new FindAllViewDto();
    findAllDto.page = page;
    findAllDto.offset = offset;
    findAllDto.totalCount = totalCount;
    findAllDto.totalPage = totalPage;
    findAllDto.data = new Array(entities.length);
    for (let i = 0; i < entities.length; i++) {
      if (Array.isArray(entities) && entities[0] instanceof BlogEntity) {
        findAllDto.data[i] = MediumRssViewDto.from(entities[i] as BlogEntity);
      }
    }
    return findAllDto;
  }

  @ApiProperty()
  public page: number;

  @ApiProperty()
  public offset: number;

  @ApiProperty()
  public totalPage: number;

  @ApiProperty()
  public totalCount: number;

  @ApiProperty()
  public data: MediumRssViewDto[] ;
}
