import { GroupEntity, RoleEntity, UserEntity, SocialProfileEntity } from '../entity';
import { ApiResponseProperty } from "@nestjs/swagger";
import { RoleViewDto } from './roleView.dto';
import { GroupViewDto } from './groupView.dto';
import { UserViewDto } from './userView.dto';
import { SocialProfileViewDto } from "./socialProfileView.dto";

export class FindAllViewDto {
  public static from(
    page: number,
    offset: number,
    totalCount: number,
    totalPage: number,
    entities: RoleEntity[] | GroupEntity[] | UserEntity[] | SocialProfileEntity[],
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
      if (Array.isArray(entities) && entities[0] instanceof RoleEntity) {
        findAllDto.data[i] = RoleViewDto.from(entities[i] as RoleEntity);

      } else if (Array.isArray(entities) && entities[0] instanceof GroupEntity) {
        findAllDto.data[i] = GroupViewDto.from(entities[i] as GroupEntity);

      } else if (Array.isArray(entities) && entities[0] instanceof UserEntity) {
        findAllDto.data[i] = UserViewDto.from(entities[i] as UserEntity);

      } else if (Array.isArray(entities) && entities[0] instanceof SocialProfileEntity) {
        findAllDto.data[i] = SocialProfileViewDto.from(entities[i] as SocialProfileEntity);
      }
    }
    return findAllDto;
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
  public data: RoleViewDto[] | GroupViewDto[] | UserViewDto[] | SocialProfileViewDto[];
}
