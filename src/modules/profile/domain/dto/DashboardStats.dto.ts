import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEntity } from '../entity';
import { stat } from 'fs';

export class DashboardStatsDto {
  public static from(roles, groups, users: number): DashboardStatsDto {
    const statsDto = new DashboardStatsDto();
    statsDto.roles = roles;
    statsDto.groups = groups;
    statsDto.users = users;
    return statsDto;
  }

  @ApiProperty()
  public users: number;

  @ApiProperty()
  public groups: number;

  @ApiProperty()
  public roles: number;
}
