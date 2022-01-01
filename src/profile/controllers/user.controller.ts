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
import { UserService } from '../services/user.service';
import { UserCreateDto } from '../domain/dto/userCreate.dto';
import { UserUpdateDto } from '../domain/dto/userUpdate.dto';
import { UserViewDto } from '../domain/dto/userView.dto';
import { UserEntity } from '../domain/entity/user.entity';

@ApiBearerAuth()
@ApiTags('/profile/user')
@Controller('/profile/user')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'The record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() userDto: UserCreateDto): Promise<string> {
    if (userDto instanceof Array) {
      this.logger.log(
        `create user failed, request ${JSON.stringify(userDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userService.create(userDto);
    return user.id;
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
  async update(@Body() userDto: UserUpdateDto): Promise<UserViewDto> {
    if (userDto instanceof Array) {
      this.logger.log(
        `update user failed, request ${JSON.stringify(userDto)} invalid`,
      );
      throw new HttpException('Request Data Invalid', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userService.update(userDto);
    return UserViewDto.from(user);
  }

  @Get('find')
  @HttpCode(HttpStatus.OK)
  // @ApiQuery({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'username', type: 'string' })
  @ApiResponse({ status: 200, description: 'The record is found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findByFilter(@Query() query): Promise<UserViewDto> {
    let user: UserEntity;
    if (query['id']) {
      user = await this.userService.findById(query['id']);
    } else if (query['username']) {
      user = await this.userService.findByName(query['username']);
    } else {
      throw new HttpException(
        { message: 'Query string invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return UserViewDto.from(user);
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
    return await this.userService.delete(params.id);
  }
}
