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
import { UserService } from '../services/user.service';
import { UserCreateDto } from '../domain/dto/userCreate.dto';
import { UserUpdateDto } from '../domain/dto/userUpdate.dto';
import { UserViewDto } from '../domain/dto/userView.dto';
import { UserEntity } from '../domain/entity';
import { isUUID } from './uuid.validate';
import { JwtAuthGuard } from '../../authentication/domain/gurads/jwt-auth.guard';
import RoleGuard from '../../authentication/domain/gurads/role.guard';

@ApiBearerAuth()
@ApiTags('/api/profile/user')
@Controller('/api/profile/user')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly userService: UserService) {}

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
  async create(@Body() userDto: UserCreateDto): Promise<string> {
    const dto = UserCreateDto.from(userDto);
    if (!dto) {
      this.logger.log(
        `request create user invalid, ${JSON.stringify(userDto)}`,
      );
      throw new BadRequestException('Invalid Input Date');
    }
    const user = await this.userService.create(dto);
    return user.id;
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() userDto: UserUpdateDto): Promise<UserViewDto> {
    const dto = UserUpdateDto.from(userDto);
    if (!dto) {
      this.logger.log(
        `request update user invalid, ${JSON.stringify(userDto)}`,
      );
      throw new BadRequestException('Invalid Input Date');
    }
    const user = await this.userService.update(dto);
    return UserViewDto.from(user);
  }

  @Get('/get/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: 'either an uuid for the user id or a string for the user name',
    schema: { oneOf: [{ type: 'string' }, { type: 'uuid' }] },
  })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getUser(@Param() params): Promise<UserViewDto> {
    let user: UserEntity;
    if (isUUID(params.param)) {
      user = await this.userService.findById(params.param);
    } else if (typeof params.param === 'string') {
      user = await this.userService.findByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data Invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user) {
      throw new HttpException(
        { message: `User Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return UserViewDto.from(user);
  }

  @Post('/delete/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: 'either an uuid for the userId or a string for the username',
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
      return await this.userService.delete(params.param);
    } else if (typeof params.param === 'string') {
      return await this.userService.deleteByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/remove/:param')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'param',
    required: true,
    description: 'either an uuid for the userId or a string for the username',
    schema: { oneOf: [{ type: 'string' }, { type: 'uuid' }] },
  })
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully removed.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async remove(@Param() params) {
    if (isUUID(params.param)) {
      return await this.userService.removeById(params.param);
    } else if (typeof params.param === 'string') {
      return await this.userService.removeByName(params.param);
    } else {
      throw new HttpException(
        { message: 'Input Data invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
