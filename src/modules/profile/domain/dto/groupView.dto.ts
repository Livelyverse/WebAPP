import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupEntity } from '../entity/group.entity';

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
  
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public name: string;

  @ApiProperty()
  public role: string;

  @ApiPropertyOptional()
  public description?: string;

  @ApiProperty()
  public createdAt: Date;

  @ApiProperty()
  public updatedAt: Date;

  @ApiProperty()
  public isActive: boolean;

  @ApiProperty()
  public isUpdatable: boolean;
}
