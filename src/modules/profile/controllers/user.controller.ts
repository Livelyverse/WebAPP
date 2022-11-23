import { ApiBearerAuth, ApiBody, ApiConsumes, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes
} from "@nestjs/common";
import { UserService, UserSortBy } from "../services/user.service";
import { UserCreateDto, UserUpdateDto, UserViewDto } from "../domain/dto";
import { UserEntity } from "../domain/entity";
import { JwtAuthGuard } from "../../authentication/domain/gurad/jwt-auth.guard";
import RoleGuard from "../../authentication/domain/gurad/role.guard";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { createReadStream } from "fs";
import { FindAllViewDto } from "../domain/dto/findAllView.dto";
import { PaginationPipe } from "../domain/pipe/paginationPipe";
import { SortType } from "../services/IService";
import { EnumPipe } from "../domain/pipe/enumPipe";
import { ValidationPipe } from "../domain/pipe/validationPipe";

@ApiBearerAuth()
@ApiTags('/api/profiles/users')
@Controller('/api/profiles/users')
export class UserController {
  private readonly _logger = new Logger(UserController.name);
  constructor(private readonly _userService: UserService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Record Created Successfully .', type: UserViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async create(@Body() userDto: UserCreateDto): Promise<UserViewDto> {
    const user = await this._userService.create(userDto);
    return UserViewDto.from(user);
  }

  @Post('update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({
    transform: true,
    skipMissingProperties: true,
    validationError: { target: false }
  }))
  @ApiResponse({ status: 200, description: 'Record Updated Successfully.', type: UserViewDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async update(@Req() req, @Body() userDto: UserUpdateDto): Promise<UserViewDto> {
    const user = await this._userService.update(userDto, req.user);
    return UserViewDto.from(user);
  }

  @Get('/find/email/:email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'email',
    required: true,
    description: 'find by email',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.' , type: UserViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findByUsername(@Param('email') email): Promise<UserViewDto> {
    let user: UserEntity;
    if (typeof email === 'string') {
      user = await this._userService.findByEmail(email);
    } else {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data Invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }

    if (!user) {
      throw new HttpException({
        statusCode: '404',
        message: `User Not Found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    return UserViewDto.from(user);
  }

  @Get('/find/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'find by userId',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Found.' , type: UserViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findUserByUserId(@Param('uuid', new ParseUUIDPipe()) uuid): Promise<UserViewDto> {
    const user = await this._userService.findById(uuid);
    if (!user) {
      throw new HttpException({
        statusCode: '404',
        message: 'User Not Found',
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    return UserViewDto.from(user);
  }

  @Get('/find')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Record Found.' , type: UserViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findUser(@Req() req): Promise<UserViewDto> {
    return UserViewDto.from(req.user);
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
    description: `data sort field can be one of ${Object.keys(UserSortBy)}`,
    schema: { enum: Object.keys(UserSortBy) },
  })
  @ApiQuery({
    name: 'sortType',
    required: false,
    description: `data sort type can be one of ${Object.keys(SortType)}`,
    schema: { enum: Object.keys(SortType) },
  })
  @ApiResponse({ status: 200, description: 'Records Found.' , type: FindAllViewDto})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async findAllUsers(
    @Query('page', new PaginationPipe()) page: number,
    @Query('offset', new PaginationPipe()) offset: number,
    @Query('sortType', new EnumPipe(SortType)) sortType: SortType,
    @Query('sortBy', new EnumPipe(UserSortBy)) sortBy: UserSortBy,
  ): Promise<FindAllViewDto> {
    const { data, total } = await this._userService.findAll(
      (page - 1) * offset,
      offset,
      sortType ? sortType : SortType.ASC,
      sortBy ? sortBy : UserSortBy.TIMESTAMP,
    );
    if (total === 0 || data.length === 0) {
      throw new HttpException({
        statusCode: '404',
        message: 'Users Not Found',
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
    description: 'soft delete by uuid',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Deleted Successfully.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async deleteByUsername(@Param('uuid', new ParseUUIDPipe()) uuid) {
    return await this._userService.delete(uuid);
  }

  @Post('/delete/email/:email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'email',
    required: true,
    description: 'soft delete by email',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Deleted Successfully.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async deleteById(@Param('email') email) {
   if (typeof email === 'string') {
      return await this._userService.deleteByEmail(email);
    } else {
     throw new HttpException({
       statusCode: '400',
       message: 'Input Data invalid',
       error: 'Bad Request'
     }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('/remove/id/:uuid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'uuid',
    required: true,
    description: 'hard delete by userid',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Removed Successfully.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async removeByUserId(@Param('uuid', new ParseUUIDPipe()) uuid) {
    return await this._userService.removeById(uuid);
  }

  @Post('/remove/email/:email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RoleGuard('ADMIN'))
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'email',
    required: true,
    description: 'hard delete by email',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Record Removed Successfully.'})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Record Not Found.' })
  @ApiResponse({ status: 417, description: 'Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async removeByUsername(@Param('email') email) {
    if (typeof email === 'string') {
      return await this._userService.removeByEmail(email);
    } else {
      throw new HttpException({
        statusCode: '400',
        message: 'Input Data invalid',
        error: 'Bad Request'
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('/image')
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
  @ApiResponse({ status: 200, description: 'Image Upload Success.', type: URL})
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 417, description: 'Auth Token Expired.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<URL> {
    return await this._userService.uploadImage(req, file);
  }

  @Get('/image/:image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'image',
    required: true,
    description: 'image name',
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: 'Get Image Success.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Image Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  async getImage(
    @Param('image') image: string,
    @Req() request: any,
    @Res() response: Response,
  ) {

    const {path, size} = await this._userService.getImage(image);

    response.writeHead(200, {
      'Content-Type': request.user.imageMimeType,
      'Content-Length': size
    });

    const file = createReadStream(path);
    file.pipe(response);
  }
}
