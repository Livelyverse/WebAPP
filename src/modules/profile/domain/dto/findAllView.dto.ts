import { GroupEntity, RoleEntity, UserEntity } from '../entity';
import { ApiProperty } from '@nestjs/swagger';
import { RoleViewDto } from './roleView.dto';
import { GroupViewDto } from './groupView.dto';
import { UserViewDto } from './userView.dto';

export class FindAllViewDto {
  public static from(
    page,
    offset,
    totalCount: number,
    totalPage: number,
    entities: RoleEntity[] | GroupEntity[] | UserEntity[],
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
      } else if (
        Array.isArray(entities) &&
        entities[0] instanceof GroupEntity
      ) {
        findAllDto.data[i] = GroupViewDto.from(entities[i] as GroupEntity);
      } else if (Array.isArray(entities) && entities[0] instanceof UserEntity) {
        findAllDto.data[i] = UserViewDto.from(entities[i] as UserEntity);
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
  public data: RoleViewDto[] | GroupViewDto[] | UserViewDto[];
}
