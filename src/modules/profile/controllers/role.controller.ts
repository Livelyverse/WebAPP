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
  UsePipes, ValidationPipe
} from "@nestjs/common";
import { RoleService, RoleSortBy } from "../services/role.service";
import { RoleCreateDto, RoleUpdateDto, RoleViewDto } from "../domain/dto";
import { RoleEntity } from "../domain/entity";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { SortType } from "../services/IService";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { EnumPipe } from "../domain/pipe/enumPipe";


@ApiBearerAuth()
@ApiTags('/api/profiles/roles')
@Controller('/api/profiles/roles')
export class RoleController {
  private readonly _logger = new Logger(RoleController.name);
  constructor(private readonly _roleService: RoleService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Record Created Successfully.', type: RoleViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() roleDto: RoleCreateDto): Promise<RoleViewDto> {
    const role = await this._roleService.create(roleDto);
    return RoleViewDto.from(role);
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
    status: 200,
    description: 'Record Updated Successfully.',
    type: RoleViewDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() roleDto: RoleUpdateDto): Promise<RoleViewDto> {
    const role = await this._roleService.update(roleDto);
    return RoleViewDto.from(role);
  }

  @Get('/find/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'find by role id',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: RoleViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findRoleById(@Param('uuid', new ParseUUIDPipe()) uuid): Promise<RoleViewDto> {
    let role: RoleEntity;
    role = await this._roleService.findById(uuid);
    if (!role) {
      throw new HttpException({
        statusCode: '404',
        message: 'Role Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }
    return RoleViewDto.from(role);
  }

  @Get('/find/name/:name')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'name',
    required: true,
    description: 'find role by name',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: RoleViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findRoleByName(@Param('name') name): Promise<RoleViewDto> {
    let role: RoleEntity;
    if (typeof name === 'string') {
      role = await this._roleService.findByName(name);
    } else {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    if (!role) {
      throw new HttpException({
        statusCode: '404',
        message: 'Role Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }
    return RoleViewDto.from(role);
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
    description: `data sort field can be one of ${Object.keys(RoleSortBy)}`,
    schema: { enum: Object.keys(RoleSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiResponse({ status: 200, description: 'Record Found.', type: FindAllViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findAllRoles(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(RoleSortBy)) sortBy: RoleSortBy,
  ): Promise<FindAllViewDto> {
    const { data, total } = await this._roleService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : RoleSortBy.TIMESTAMP,
    );
    if (total === 0 || data.length === 0) {
      throw new HttpException({
        statusCode: '404',
        message: 'Roles Not Found',
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
    description: 'soft delete by role name',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Record Deleted Successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 422, description: 'Record Could Not Deleted.', })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async deleteById(@Param('uuid', new ParseUUIDPipe()) uuid) {
    return await this._roleService.delete(uuid);
  }

  @Post('/delete/name/:name')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'name',
    required: true,
    description: 'soft delete by role name',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Deleted successfully.'})
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 422, description: 'Record Could Not Deleted.'})
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async delete(@Param('name') name) {
    if (typeof name === 'string') {
      return await this._roleService.deleteByName(name);
    } else {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data invalid',
        error: 'Not Found'
      }, HttpStatus.BAD_REQUEST);
    }
  }
}
