import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UserCreateDto } from '../domain/dto/userCreate.dto';
import { UserUpdateDto } from '../domain/dto/userUpdate.dto';
import { UserViewDto } from '../domain/dto/userView.dto';
import { UserEntity } from '../domain/entity';
import { isUUID } from './uuid.validate';
import { JwtAuthGuard } from '../../authentication/domain/gurads/jwt-auth.guard';
import RoleGuard from '../../authentication/domain/gurads/role.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream } from 'fs';

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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() userDto: UserCreateDto): Promise<string> {
    const dto = UserCreateDto.from(userDto);
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Body() userDto: UserUpdateDto): Promise<UserViewDto> {
    const dto = UserUpdateDto.from(userDto);
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
  @ApiResponse({ status: 417, description: 'Token Expired.' })
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
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
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
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'The requested record not found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
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

  @Post('/image/upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image Upload Success.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<URL> {
    return await this.userService.uploadImage(req, file);
  }

  @Get('/image/get/:image')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Get Image Success.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Image Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  getImage(
    @Param('image') image: string,
    @Req() request: any,
    @Res() response: Response,
  ) {
    const file = createReadStream(this.userService.getImage(image));
    file.pipe(response);

    // response.sendFile(
    //   ,
    //   (error) => {
    //     if (error) {
    //       this.logger.error(
    //         `could not read file ${image} for user: ${request.user.username}`,
    //         error,
    //       );
    //       throw new HttpException(
    //         { message: 'Something went wrong' },
    //         HttpStatus.INTERNAL_SERVER_ERROR,
    //       );
    //     }
    //   },
    // );
    // await this.userService.getImage(request.user, image);
  }
}
