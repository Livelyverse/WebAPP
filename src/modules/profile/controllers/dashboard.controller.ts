import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { GroupService } from '../services/group.service';
import { RoleService } from '../services/role.service';
import RoleGuard from '../../authentication/domain/gurad/role.guard';
import { JwtAuthGuard } from '../../authentication/domain/gurad/jwt-auth.guard';
import { DashboardStatsDto } from '../domain/dto/dashboardStats.dto';

@ApiBearerAuth()
@ApiTags('/api/backoffice/dashboard')
@Controller('/api/backoffice/dashboard')
export class BackofficeController {
  private readonly logger = new Logger(BackofficeController.name);
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService,
    private readonly roleService: RoleService,
  ) {}

  @Get('/stats')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Backoffice dashboard stats fetch success',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getStats(): Promise<DashboardStatsDto> {
    const statsDto = new DashboardStatsDto();

    statsDto.users = await this.userService.findTotal();
    statsDto.roles = await this.roleService.findTotal();
    statsDto.groups = await this.groupService.findTotal();

    return statsDto;
  }
}
