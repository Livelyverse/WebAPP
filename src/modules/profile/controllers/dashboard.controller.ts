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
import { UserGroupService } from '../services/userGroup.service';
import { RoleService } from '../services/role.service';
import RoleGuard from '../../authentication/domain/gurad/role.guard';
import { JwtAuthGuard } from '../../authentication/domain/gurad/jwt-auth.guard';
import { DashboardStatsViewDto } from '../domain/dto/dashboardStatsView.dto';

@ApiBearerAuth()
@ApiTags('/api/backoffice/dashboard')
@Controller('/api/backoffice/dashboard')
export class BackofficeController {
  private readonly _logger = new Logger(BackofficeController.name);
  constructor(
    private readonly _userService: UserService,
    private readonly _groupService: UserGroupService,
    private readonly _roleService: RoleService,
  ) {}

  @Get('/stats')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'Dashboard States Fetched',
    type: DashboardStatsViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getStats(): Promise<DashboardStatsViewDto> {
    const statsDto = new DashboardStatsViewDto();

    statsDto.users = await this._userService.findTotal();
    statsDto.roles = await this._roleService.findTotal();
    statsDto.userGroups = await this._groupService.findTotal();

    return statsDto;
  }
}
