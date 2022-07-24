import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BadRequestException,
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
import { GroupEntity } from '../domain/entity';
import { isUUID } from './uuid.validate';
import { JwtAuthGuard } from '../../authentication/domain/gurad/jwt-auth.guard';
import RoleGuard from '../../authentication/domain/gurad/role.guard';
import { FindAllViewDto } from '../domain/dto/findAllView.dto';

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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() groupDto: GroupCreateDto): Promise<string> {
    const dto = GroupCreateDto.from(groupDto);
    const group = await this.groupService.create(dto);
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() groupDto: GroupUpdateDto): Promise<GroupViewDto> {
    const dto = GroupUpdateDto.from(groupDto);
    const group = await this.groupService.update(dto);
    return GroupViewDto.from(group);
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
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

  @Get('/getAll')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiQuery({
    name: 'page',
    required: true,
    description: 'data page',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'offset',
    required: true,
    description: 'data offset',
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: true,
    description: 'data sort field can be one of the name or the time fields',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'sortType',
    required: true,
    description: 'data sort type can be one of ASC or DESC',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getAllGroups(
    @Query('page') page,
    @Query('offset') offset,
    @Query('sortType') sortType,
    @Query('sortBy') sortBy,
  ): Promise<FindAllViewDto> {
    if (page < 0) {
      throw new HttpException(
        { message: 'Page Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (offset <= 0) {
      throw new HttpException(
        { message: 'Offset Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (sortType.toUpperCase() !== 'DESC' && sortType.toUpperCase() !== 'ASC') {
      throw new HttpException(
        { message: 'SortType Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    sortBy = sortBy.toLowerCase();
    if (sortBy !== 'name' && sortBy !== 'time') {
      throw new HttpException(
        { message: 'sortBy Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (sortBy === 'time') sortBy = 'createdAt';

    const { data, total } = await this.groupService.findAll(
      page * offset,
      offset,
      sortType,
      sortBy,
    );
    if (total === 0 || data.length === 0) {
      throw new HttpException(
        { message: 'Groups Not Found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const totalPage = Math.ceil(total / offset);
    return FindAllViewDto.from(page, offset, total, totalPage, data);
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({
    status: 422,
    description: 'The requested record could not deleted.',
  })
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
