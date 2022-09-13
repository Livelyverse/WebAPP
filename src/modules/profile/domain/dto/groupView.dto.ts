import { ApiProperty, ApiPropertyOptional, ApiResponseProperty } from "@nestjs/swagger";
import { GroupEntity } from '../entity';

export class GroupViewDto {
  public static from(group: GroupEntity): GroupViewDto | null {
    if (group) {
      const groupDto = new GroupViewDto();
      groupDto.id = group.id;
      groupDto.name = group.name;
      groupDto.role = group.role.name;
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
  public description?: string;

  @ApiResponseProperty()
  public createdAt: Date;

  @ApiResponseProperty()
  public updatedAt: Date;

  @ApiResponseProperty()
  public isActive: boolean;

  @ApiResponseProperty()
  public isUpdatable: boolean;
}
