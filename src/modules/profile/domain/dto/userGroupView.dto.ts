import { ApiResponseProperty } from "@nestjs/swagger";
import { UserGroupEntity } from '../entity';

export class UserGroupViewDto {
  public static from(group: UserGroupEntity): UserGroupViewDto | null {
    if (group) {
      const groupDto = new UserGroupViewDto();
      groupDto.id = group.id;
      groupDto.name = group.name;
      groupDto.role = group.role.name;
      groupDto.description = group.description;
      groupDto.createdAt = group.createdAt;
      groupDto.updatedAt = group.updatedAt;
      groupDto.isActive = group.isActive;
      groupDto.isUpdatable = group.isUpdatable;
      return groupDto;
    }
    return null;
  }

  @ApiResponseProperty()
  public id: string;

  @ApiResponseProperty()
  public name: string;

  @ApiResponseProperty()
  public role: string;

  @ApiResponseProperty()
  public description: string;

  @ApiResponseProperty()
  public createdAt: Date;

  @ApiResponseProperty()
  public updatedAt: Date;

  @ApiResponseProperty()
  public isActive: boolean;

  @ApiResponseProperty()
  public isUpdatable: boolean;
}
