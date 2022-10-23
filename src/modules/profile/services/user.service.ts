import {
  CACHE_MANAGER,
  HttpException,
  HttpStatus, Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto, UserUpdateDto } from '../domain/dto';
import { validate } from 'class-validator';
import { FindAllType, IService, SortType } from "./IService";
import { UserEntity } from '../domain/entity';
import { UserGroupService } from './userGroup.service';
import * as argon2 from 'argon2';
import { PostgresErrorCode } from './postgresErrorCode.enum';
import { extname, join } from 'path';
import * as fs from 'fs';
import {
  AuthMailEntity,
  AuthTokenEntity,
} from '../../authentication/domain/entity';
import { ConfigService } from '@nestjs/config';
import { Cache } from "cache-manager";

export enum UserSortBy {
  TIMESTAMP = 'createdAt',
  USERNAME = 'username'
}


@Injectable()
export class UserService implements IService<UserEntity> {
  private readonly _logger = new Logger(UserService.name);
  private readonly _uploadPath;

  constructor(
    @InjectRepository(AuthTokenEntity)
    private readonly _tokenRepository: Repository<AuthTokenEntity>,
    @InjectRepository(AuthMailEntity)
    private readonly _authMailRepository: Repository<AuthMailEntity>,
    @InjectRepository(UserEntity)
    private readonly _userRepository: Repository<UserEntity>,
    @Inject(CACHE_MANAGER)
    private readonly _cacheManager: Cache,
    private readonly _userGroupService: UserGroupService,
    private readonly _configService: ConfigService,
  ) {
    this._uploadPath =
      process.cwd() +
      '/' +
      this._configService.get<string>('http.upload.path') +
      '/';
  }

  async create(userDto: UserCreateDto): Promise<UserEntity> {
    const groupEntity = await this._userGroupService.findByName(
      userDto.userGroup.toUpperCase(),
    );
    if (!groupEntity) {
      this._logger.log(
        `groupService.findByName failed, group not found: ${userDto.userGroup.toUpperCase()}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: `Create user ${
          userDto.email
        } failed, group ${userDto.userGroup.toUpperCase()} not found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND)
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(userDto.password);
    } catch (err) {
      this._logger.error(`argon2.hash failed, userDto: ${userDto}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    // create new profile
    let newUser = new UserEntity();
    // newUser.username = userDto.username;
    newUser.email = userDto.email;
    newUser.password = hashPassword;
    newUser.firstname = userDto.firstname;
    newUser.lastname = userDto.lastname;
    newUser.userGroup = groupEntity;

    try {
      newUser = await this._userRepository.save(newUser);
    } catch (error) {
      this._logger.error(
        `userRepository.save in user creation failed, email: ${newUser.email}, userGroup: ${newUser.userGroup}`,
        error,
      );
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException({
          statusCode: '400',
          message: 'User already exists',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST)
      }
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return newUser;
  }

  async deleteByEmail(email: string): Promise<void> {
    let deleteResult;
    try {
      deleteResult = await this._userRepository.softDelete({ email: email });
    } catch (err) {
      this._logger.error(`userRepository.softDelete failed, mail: ${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async delete(id: string): Promise<void> {
    let deleteResult;
    try {
      deleteResult = await this._userRepository.softDelete({ id: id });
    } catch (err) {
      this._logger.error(`userRepository.softDelete failed: ${id}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async removeByEmail(email: string): Promise<void> {
    let user;
    try {
        user = await this._userRepository.findOne({
        relations: {
          userGroup: true
        },
        join: {
          alias: "users",
          innerJoinAndSelect: {
            group: "users.userGroup",
            role: "group.role",
          }
        },
        withDeleted: true,
        loadEagerRelations: true,
        where: {
          email: email
        }
      });
    } catch (err) {
      this._logger.error(`userRepository.findOne failed, email: ${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!user) {
      throw new HttpException({
        statusCode: '404',
        message: `Email ${email} Not Found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND)
    }

    const authMails = await this._authMailRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authMails && authMails.length > 0) {
      for (let i = 0; i < authMails.length; i++) {
        try {
          await this._authMailRepository.remove(authMails[i]);
        } catch (error) {
          this._logger.error(
            `authMailRepository.remove failed: authMail id ${authMails[i].id}`,
            error,
          );
        }
      }
    }

    const authTokens = await this._tokenRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authTokens && authTokens.length > 0) {
      for (let i = 0; i < authTokens.length; i++) {
        try {
          await this._tokenRepository.remove(authTokens[i]);
        } catch (error) {
          this._logger.error(
            `tokenRepository.remove failed: authToken id ${authTokens[i].id}`,
            error,
          );
        }
      }
    }

    await this._cacheManager.del(`USER.EMAIL:${user.email}`);
    await this._cacheManager.del(`AUTH_ACCESS_TOKEN.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_REFRESH_TOKEN.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID::${user.id}`);
    try {
      await this._userRepository.remove(user);
    } catch (err) {
      this._logger.error(`userRepository.remove failed: ${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async removeById(id: string): Promise<void> {

    let user;
    try {
      user = await this._userRepository.findOne({
        relations: {
          userGroup: true
        },
        join: {
          alias: "users",
          innerJoinAndSelect: {
            group: "users.userGroup",
            role: "group.role",
          }
        },
        withDeleted: true,
        loadEagerRelations: true,
        where: {
          id: id
        }
      });
    } catch (err) {
      this._logger.error(`userRepository.findOne failed. id: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!user) {
      throw new NotFoundException({ message: `User Id ${id} not found` });
    }

    const authMails = await this._authMailRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authMails && authMails.length > 0) {
      for (let i = 0; i < authMails.length; i++) {
        try {
          await this._authMailRepository.remove(authMails[i]);
        } catch (error) {
          this._logger.error(
            `authMailRepository.remove failed: authMail id ${authMails[i].id}`,
            error,
          );
        }
      }
    }

    const authTokens = await this._tokenRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authTokens && authTokens.length > 0) {
      for (let i = 0; i < authTokens.length; i++) {
        try {
          await this._tokenRepository.remove(authTokens[i]);
        } catch (error) {
          this._logger.error(
            `tokenRepository.remove failed: authToken id ${authTokens[i].id}`,
            error,
          );
        }
      }
    }

    await this._cacheManager.del(`USER.EMAIL:${user.email}`);
    await this._cacheManager.del(`AUTH_ACCESS_TOKEN.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_REFRESH_TOKEN.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_MAIL_USER_VERIFICATION.USER_ID:${user.id}`);
    await this._cacheManager.del(`AUTH_MAIL_FORGOTTEN_PASSWORD.USER_ID::${user.id}`);
    try {
      await this._userRepository.remove(user);
    } catch (err) {
      this._logger.error(`userRepository.remove failed: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async findTotal(): Promise<number> {
    try {
      return await this._userRepository.count();
    } catch (err) {
      this._logger.error(`userRepository.count failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: UserSortBy,
  ): Promise<FindAllType<UserEntity>> {
    try {
      const res = await this._userRepository.findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType,
        },
      });
      return {
        data: res[0],
        total: res[1],
      };
    } catch (err) {
      this._logger.error(`userRepository.find failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    try {
      return await this._userRepository.findOne({
        relations: {
          userGroup: true
        },
        join: {
          alias: "users",
          innerJoinAndSelect: {
            group: "users.userGroup",
            role: "group.role",
          }
        },
        loadEagerRelations: true,
        where: {
          id: id
        }
      });
    } catch (err) {
      this._logger.error(`userRepository.findOne failed. id: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  // async findByName(name: string): Promise<UserEntity | null> {
  //   try {
  //     return await this._userRepository.findOne({ where: { username: name } });
  //   } catch (err) {
  //     this._logger.error(`userRepository.findOne failed, name: ${name}`, err);
  //     throw new HttpException({
  //       statusCode: '500',
  //       message: 'Something Went Wrong',
  //       error: 'Internal Server Error'
  //     }, HttpStatus.INTERNAL_SERVER_ERROR)
  //   }
  // }

  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      return await this._userRepository.findOne({
        relations: {
          userGroup: true
        },
        join: {
          alias: "users",
          innerJoinAndSelect: {
            group: "users.userGroup",
            role: "group.role",
          }
        },
        loadEagerRelations: true,
        where: {
          email: email
        }
      });
    } catch (err) {
      this._logger.error(`userRepository.findOne failed, email: ${email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async findOne(options: object): Promise<UserEntity | null> {
    try {
      return await this._userRepository.findOne(options);
    } catch (err) {
      this._logger.error(
        `userRepository.findOne failed, options: ${JSON.stringify(options)}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async update(userDto: UserUpdateDto, entity: UserEntity): Promise<UserEntity> {
    try {
      entity.firstname = userDto.firstname;
      entity.lastname = userDto.lastname;
      entity.walletAddress = userDto.walletAddress;
      return await this._userRepository.save(entity);
    } catch (err) {
      this._logger.error(
        `userRepository.save failed: ${JSON.stringify(userDto)}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async updateEntity(user: UserEntity): Promise<UserEntity> {
    try {
      return await this._userRepository.save(user);
    } catch (err) {
      this._logger.error(`userRepository.save failed, mail: ${user.email}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  async uploadImage(request: any, file: Express.Multer.File): Promise<URL> {
    const user = request.user as UserEntity;
    const fileExtName = extname(file.originalname);
    const filename = `profilePhoto_${user.id}_${Date.now()}${fileExtName}`;
    const tmpArray = request.url.split('/');
    const absoluteUrl =
      'https://' +
      this._configService.get<string>('http.domain') +
      tmpArray.splice(0, tmpArray.length - 1).join('/') +
      '/get/' +
      filename;

    if (user.imageFilename) {
      const oldImageFile = this._uploadPath + user.imageFilename;
      if (fs.existsSync(oldImageFile)) {
        try {
          fs.rmSync(oldImageFile);
        } catch (error) {
          this._logger.error(`could not remove file ${oldImageFile}`, error);
        }
      }
    }

    try {
      fs.writeFileSync(this._uploadPath + filename, file.buffer);
    } catch (error) {
      this._logger.error(
        `could not write file ${this._uploadPath + filename}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    try {
      user.imageUrl = absoluteUrl;
      user.imageMimeType = file.mimetype;
      user.imageFilename = filename;
      await this._userRepository.save(user);
    } catch (error) {
      this._logger.error(
        `userRepository.save of uploadImage failed, email: ${JSON.stringify(
          user.email,
        )}`,
        error,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return new URL(absoluteUrl);
  }

  public getImage(image: string): string {
    const imageFile = this._uploadPath + image;
    if (fs.existsSync(imageFile)) {
      return imageFile;
    } else {
      this._logger.error(`could not found file ${imageFile}`);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
