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
import { GroupService } from '../services/group.service';
import { GroupCreateDto } from '../domain/dto/groupCreate.dto';
import { GroupViewDto } from '../domain/dto/groupView.dto';
import { GroupUpdateDto } from '../domain/dto/groupUpdate.dto';
import { GroupEntity } from '../domain/entity/group.entity';

@ApiBearerAuth()
@ApiTags('/profile/group')
@Controller('/profile/group')
export class GroupController {
  private readonly logger = new Logger(GroupController.name);
  constructor(private readonly groupService: GroupService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  // @ApiBody({ type: GroupCreateDto })
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
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
  // @ApiBody({ type: [GroupUpdateDto] })
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
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

  @Get('find')
  @HttpCode(HttpStatus.OK)
  // @ApiQuery({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'name', type: 'string' })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findByFilter(@Query() query): Promise<GroupViewDto> {
    let group: GroupEntity;
    if (query['id']) {
      group = await this.groupService.findById(query['id']);
    } else if (query['name']) {
      group = await this.groupService.findByName(query['name']);
    } else {
      throw new HttpException(
        { message: 'Query string invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return GroupViewDto.from(group);
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
    return await this.groupService.delete(params.id);
  }
}
