import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEntity } from '../entity';

export class RoleViewDto {
  public static from(role: RoleEntity): RoleViewDto | null {
    if (role) {
      const roleDto = new RoleViewDto();
      roleDto.id = role.id;
      roleDto.name = role.name;
      roleDto.createdAt = role.createdAt;
      roleDto.updatedAt = role.updatedAt;
      roleDto.isActive = role.isActive;
      roleDto.isUpdatable = role.isUpdatable;
      return roleDto;
    }
    return null;
  }

  @ApiProperty()
  public id: string;

  @ApiProperty()
  public name: string;

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
