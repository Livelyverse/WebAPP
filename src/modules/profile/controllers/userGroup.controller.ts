import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes
} from "@nestjs/common";
import { UserGroupService, UserGroupSortBy } from "../services/userGroup.service";
import { UserGroupCreateDto, UserGroupUpdateDto, UserGroupViewDto } from "../domain/dto";
import { UserGroupEntity } from "../domain/entity";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { ValidationPipe } from "../../airdrop/domain/pipe/validationPipe";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortType } from "../services/IService";
import { EnumPipe } from "../domain/pipe/enumPipe";

@ApiBearerAuth()
@ApiTags('/api/profiles/user-groups')
@Controller('/api/profiles/user-groups')
export class UserGroupController {
  private readonly _logger = new Logger(UserGroupController.name);
  constructor(private readonly _userGroupService: UserGroupService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Record Created successfully', type: UserGroupViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() userGroupDto: UserGroupCreateDto): Promise<UserGroupViewDto> {
    const group = await this._userGroupService.create(userGroupDto);
    return UserGroupViewDto.from(group);
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({
    status: 200, description: 'Record Updated Successfully.', type: UserGroupViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() userGroupDto: UserGroupUpdateDto): Promise<UserGroupViewDto> {
    const group = await this._userGroupService.update(userGroupDto);
    return UserGroupViewDto.from(group);
  }

  @Get('/find/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'find by group id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: UserGroupViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findUserGroupById(@Param('uuid', new ParseUUIDPipe()) uuid): Promise<UserGroupViewDto> {
    const group = await this._userGroupService.findById(uuid);

    if (!group) {
      throw new HttpException(
        { message: `UserGroup Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return UserGroupViewDto.from(group);
  }

  @Get('/find/name/:name')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'name',
    required: true,
    description: 'find by group name',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: UserGroupViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getGroup(@Param('name') name): Promise<UserGroupViewDto> {
    let group: UserGroupEntity;
    if (typeof name === 'string') {
      group = await this._userGroupService.findByName(name);
    } else {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    if (!group) {
      throw new HttpException({
        statusCode: '404',
        message: 'UserGroup Not Found',
        error: 'Bad Request'
      }, HttpStatus.NOT_FOUND);
    }

    return UserGroupViewDto.from(group);
  }

  @Get('/find/all')
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
    required: false,
    description: `data sort field can be one of ${Object.keys(UserGroupSortBy)}`,
    schema: { enum: Object.keys(UserGroupSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findAllUserGroups(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(UserGroupSortBy)) sortBy: UserGroupSortBy,
  ): Promise<FindAllViewDto> {
    const { data, total } = await this._userGroupService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : UserGroupSortBy.TIMESTAMP,
    );
    if (total === 0 || data.length === 0) {
      throw new HttpException({
        statusCode: '404',
        message: 'UserGroups Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    const totalPage = Math.ceil(total / offset);
    return FindAllViewDto.from(page, offset, total, totalPage, data);
  }

  @Post('/delete/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'soft delete by group id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Deleted successfully.'})
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 422, description: 'Record Could Not Deleted.', })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async deleteUserGroupById(@Param('uuid', new ParseUUIDPipe()) uuid) {
      return await this._userGroupService.deleteByName(uuid);
  }

  @Post('/delete/name/:name')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'name',
    required: true,
    description: 'soft delete by group name',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Deleted Successfully.'})
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 422, description: 'Record Could Not Deleted.'})
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async delete(@Param('name') name) {
    if (typeof name === 'string') {
      return await this._userGroupService.deleteByName(name);
    } else {
      throw new HttpException(
        { message: 'Input Data invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
