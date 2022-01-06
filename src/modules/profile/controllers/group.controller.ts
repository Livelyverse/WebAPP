import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GroupService } from '../services/group.service';
import { GroupCreateDto } from '../domain/dto/groupCreate.dto';
import { GroupViewDto } from '../domain/dto/groupView.dto';
import { GroupUpdateDto } from '../domain/dto/groupUpdate.dto';
import { GroupEntity } from '../domain/entity/group.entity';
import { isUUID } from './uuid.validate';
import { JwtAuthGuard } from '../../authentication/domain/gurads/jwt-auth.guard';
import RoleGuard from '../../authentication/domain/gurads/role.guard';

@ApiBearerAuth()
@ApiTags('/api/profile/group')
@Controller('/api/profile/group')
export class GroupController {
  private readonly logger = new Logger(GroupController.name);
  constructor(private readonly groupService: GroupService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() groupDto: GroupCreateDto): Promise<string> {
    if (groupDto instanceof Array) {
      this.logger.log(
        `create group failed, request ${JSON.stringify(groupDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const group = await this.groupService.create(groupDto);
    return group.id;
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() groupDto: GroupUpdateDto): Promise<GroupViewDto> {
    if (groupDto instanceof Array) {
      this.logger.log(
        `update group failed, request ${JSON.stringify(groupDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const role = await this.groupService.update(groupDto);
    return GroupViewDto.from(role);
  }

  @Get('/get/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description:
      'either an uuid for the group id or a string for the group name',
    schema: { oneOf: [{ type: 'string' }, { type: 'uuid' }] },
  })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getGroup(@Param() params): Promise<GroupViewDto> {
    let group: GroupEntity;
    if (isUUID(params.param)) {
      group = await this.groupService.findById(params.param);
    } else if (typeof params.param === 'string') {
      group = await this.groupService.findByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!group) {
      throw new HttpException(
        { message: `Group Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return GroupViewDto.from(group);
  }

  @Post('/delete/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description:
      'either an uuid for the groupId or a string for the group name',
    schema: { oneOf: [{ type: 'string' }, { type: 'uuid' }] },
  })
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully deleted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async delete(@Param() params) {
    if (isUUID(params.param)) {
      return await this.groupService.delete(params.param);
    } else if (typeof params.param === 'string') {
      return await this.groupService.deleteByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
