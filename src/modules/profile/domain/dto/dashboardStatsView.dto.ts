import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsViewDto {
  public static from(roles, groups, users: number): DashboardStatsViewDto {
    const statsDto = new DashboardStatsViewDto();
    statsDto.roles = roles;
    statsDto.userGroups = groups;
    statsDto.users = users;
    return statsDto;
  }

  @ApiProperty()
  public users: number;

  @ApiProperty()
  public userGroups: number;

  @ApiProperty()
  public roles: number;
}
