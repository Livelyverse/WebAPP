import {
  ApiBearerAuth,
  ApiBody,
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

@ApiBearerAuth()
@ApiTags('/profile/role')
@Controller('/profile/role')
export class RoleController {
  private readonly logger = new Logger(RoleController.name);
  constructor(private readonly roleService: RoleService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() roleDto: RoleCreateDto): Promise<string> {
    if (roleDto instanceof Array) {
      this.logger.log(
        `create role failed, request ${JSON.stringify(roleDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const role = await this.roleService.create(roleDto);
    return role.id;
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() roleDto: RoleUpdateDto): Promise<RoleViewDto> {
    if (roleDto instanceof Array) {
      this.logger.log(
        `update role failed, request ${JSON.stringify(roleDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const role = await this.roleService.update(roleDto);
    return RoleViewDto.from(role);
  }

  @Get('find')
  @HttpCode(HttpStatus.OK)
  // @ApiQuery({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'name', type: 'string' })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findByFilter(@Query() query): Promise<RoleViewDto> {
    let role: RoleEntity;
    if (query['id']) {
      role = await this.roleService.findById(query['id']);
    } else if (query['name']) {
      role = await this.roleService.findByName(query['name']);
    } else {
      throw new HttpException(
        { message: 'Query string invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return RoleViewDto.from(role);
  }

  @Post('/delete/:id')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async delete(@Param() params) {
    return await this.roleService.delete(params.id);
  }
}
