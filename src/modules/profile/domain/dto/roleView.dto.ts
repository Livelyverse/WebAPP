import { ApiProperty, ApiPropertyOptional, ApiResponseProperty } from "@nestjs/swagger";
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

  @ApiResponseProperty()
  public id: string;

  @ApiResponseProperty()
  public name: string;

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
