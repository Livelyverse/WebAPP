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
import { RoleService } from '../services/role.service';
import { RoleCreateDto } from '../domain/dto/roleCreate.dto';
import { RoleUpdateDto } from '../domain/dto/roleUpdate.dto';
import { RoleViewDto } from '../domain/dto/roleView.dto';
import { RoleEntity } from '../domain/entity/role.entity';
import { isUUID } from './uuid.validate';
import { JwtAuthGuard } from '../../authentication/domain/gurads/jwt-auth.guard';
import RoleGuard from '../../authentication/domain/gurads/role.guard';

@ApiBearerAuth()
@ApiTags('/api/profile/role')
@Controller('/api/profile/role')
export class RoleController {
  private readonly logger = new Logger(RoleController.name);
  constructor(private readonly roleService: RoleService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() roleDto: RoleCreateDto): Promise<string> {
    if (roleDto instanceof Array) {
      this.logger.log(
        `create role failed, request: ${JSON.stringify(roleDto)}`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const role = await this.roleService.create(roleDto);
    return role.id;
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
  async update(@Body() roleDto: RoleUpdateDto): Promise<RoleViewDto> {
    if (roleDto instanceof Array) {
      this.logger.log(
        `update role failed, request: ${JSON.stringify(roleDto)}`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const role = await this.roleService.update(roleDto);
    return RoleViewDto.from(role);
  }

  @Get('/get/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: 'either an uuid for the role id or a string for the role name',
    schema: { oneOf: [{ type: 'string' }, { type: 'uuid' }] },
  })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getRole(@Param() params): Promise<RoleViewDto> {
    let role: RoleEntity;
    if (isUUID(params.param)) {
      role = await this.roleService.findById(params.param);
    } else if (typeof params.param === 'string') {
      role = await this.roleService.findByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!role) {
      throw new HttpException(
        { message: `Role Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }
    return RoleViewDto.from(role);
  }

  @Post('/delete/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: 'either an uuid for the roleId or a string for the group name',
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
      return await this.roleService.delete(params.param);
    } else if (typeof params.param === 'string') {
      return await this.roleService.deleteByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
