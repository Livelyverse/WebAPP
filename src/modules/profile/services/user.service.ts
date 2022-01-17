import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCreateDto, UserUpdateDto } from '../domain/dto/index.dto';
import { validate } from 'class-validator';
import { IService } from './IService';
import { UserEntity } from '../domain/entity';
import { GroupService } from './group.service';
import * as argon2 from 'argon2';
import { PostgresErrorCode } from './postgresErrorCode.enum';
import {
  AuthMailEntity,
  TokenEntity,
} from '../../authentication/domain/entity';

@Injectable()
export class UserService implements IService<UserEntity> {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(TokenEntity)
    private readonly tokenRepository: Repository<TokenEntity>,
    @InjectRepository(AuthMailEntity)
    private readonly authMailRepository: Repository<AuthMailEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly groupService: GroupService,
  ) {}

  async create(userDto: UserCreateDto): Promise<UserEntity> {
    const errors = await validate(userDto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `create user validation failed, dto: ${JSON.stringify(
          userDto,
        )}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input data validation failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    const groupEntity = await this.groupService.findByName(
      userDto.group.toUpperCase(),
    );
    if (!groupEntity) {
      this.logger.log(
        `groupService.findByName failed, group not found: ${userDto.group.toUpperCase()}`,
      );
      throw new HttpException(
        {
          message: `Create user ${
            userDto.username
          } failed, group ${userDto.group.toUpperCase()} not found`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    let hashPassword;
    try {
      hashPassword = await argon2.hash(userDto.password);
    } catch (err) {
      this.logger.error(`argon2.hash failed, userDto: ${userDto}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // create new profile
    let newUser = new UserEntity();
    newUser.username = userDto.username;
    newUser.email = userDto.email;
    newUser.password = hashPassword;
    newUser.firstname = userDto.firstname;
    newUser.lastname = userDto.lastname;
    newUser.group = groupEntity;

    try {
      newUser = await this.userRepository.save(newUser);
    } catch (error) {
      this.logger.error(
        `userRepository.save in user creation failed, username: ${newUser.username}, email: ${newUser.email}, group: ${newUser.group}`,
        error,
      );
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return newUser;
  }

  async deleteByName(name: string): Promise<void> {
    let deleteResult;
    try {
      deleteResult = await this.userRepository.softDelete({ username: name });
    } catch (err) {
      this.logger.error(`userRepository.softDelete failed: ${name}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleteResult.affected) {
      throw new HttpException(
        { message: `Username ${name} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async delete(id: string): Promise<void> {
    let deleteResult;
    try {
      deleteResult = await this.userRepository.softDelete({ id: id });
    } catch (err) {
      this.logger.error(`userRepository.softDelete failed: ${id}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleteResult.affected) {
      throw new HttpException(
        { message: `User Id ${id} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async removeByName(name: string): Promise<void> {
    // let deleteResult;
    const user = await this.findByName(name);

    if (!user) {
      throw new NotFoundException(`Username ${name} not found`);
    }

    const authMails = await this.authMailRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authMails && authMails.length > 0) {
      for (let i = 0; i < authMails.length; i++) {
        try {
          await this.authMailRepository.remove(authMails[i]);
        } catch (error) {
          this.logger.error(
            `authMailRepository.remove failed: authMail id ${authMails[i].id}`,
            error,
          );
        }
      }
    }

    const token = await this.tokenRepository.findOne({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (token) {
      try {
        await this.tokenRepository.remove(token);
      } catch (error) {
        this.logger.error(
          `tokenRepository.remove failed: token id ${token.id}`,
          error,
        );
      }
    }

    try {
      await this.userRepository.remove(user);
    } catch (err) {
      this.logger.error(`userRepository.remove failed: ${name}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // if (!deleteResult.affected) {
    //   throw new HttpException(
    //     { message: `Username ${name} Not Found` },
    //     HttpStatus.NOT_FOUND,
    //   );
    // }
  }

  async removeById(id: string): Promise<void> {
    // let deleteResult;
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`Username ${name} not found`);
    }

    const authMails = await this.authMailRepository.find({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (authMails && authMails.length > 0) {
      for (let i = 0; i < authMails.length; i++) {
        try {
          await this.authMailRepository.remove(authMails[i]);
        } catch (error) {
          this.logger.error(
            `authMailRepository.remove failed: authMail id ${authMails[i].id}`,
            error,
          );
        }
      }
    }

    const token = await this.tokenRepository.findOne({
      relations: ['user'],
      where: {
        user: { id: user.id },
      },
    });

    if (token) {
      try {
        await this.tokenRepository.remove(token);
      } catch (error) {
        this.logger.error(
          `tokenRepository.remove failed: token id ${token.id}`,
          error,
        );
      }
    }

    try {
      await this.userRepository.remove(user);
    } catch (err) {
      this.logger.error(`userRepository.remove failed: ${id}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // if (!deleteResult.affected) {
    //   throw new HttpException(
    //     { message: `User Id ${id} Not Found` },
    //     HttpStatus.NOT_FOUND,
    //   );
    // }
  }

  async findAll(): Promise<Array<UserEntity> | null> {
    try {
      return await this.userRepository.find();
    } catch (err) {
      this.logger.error(`userRepository.find failed`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findById(id: string): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOne({ where: { id: id } });
    } catch (err) {
      this.logger.error(`userRepository.findOne failed. id: ${id}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByName(name: string): Promise<UserEntity> {
    try {
      return await this.userRepository.findOne({ where: { username: name } });
    } catch (err) {
      this.logger.error(`userRepository.findOne failed, name: ${name}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(options: object): Promise<UserEntity | null> {
    try {
      return await this.userRepository.findOne(options);
    } catch (err) {
      this.logger.error(
        `userRepository.findOne failed, options: ${JSON.stringify(options)}`,
        err,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(userDto: UserUpdateDto): Promise<UserEntity> {
    const errors = await validate(userDto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `user update validation failed, dto: ${userDto}, errors: ${errors}`,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userDto.id },
    });
    if (!user) {
      this.logger.log(
        `userRepository.findOne failed, group not found: ${userDto.username}`,
      );
      throw new HttpException(
        { message: `Update group failed, ${userDto.username} not found` },
        HttpStatus.NOT_FOUND,
      );
    }

    // const groupEntity = await this.groupService.findByName(
    //   userDto.group.toUpperCase(),
    // );
    // if (!groupEntity) {
    //   this.logger.log(
    //     `groupService.findByName failed, group '${userDto.group.toUpperCase()}' not found`,
    //   );
    //   throw new HttpException(
    //     {
    //       message: `update user ${
    //         userDto.username
    //       } failed, group ${userDto.group.toUpperCase()} not found`,
    //     },
    //     HttpStatus.NOT_FOUND,
    //   );
    // }

    try {
      user.firstname = userDto.firstname;
      user.lastname = userDto.lastname;
      // user.group = groupEntity;
      user.imageUrl = userDto.imageUrl;
      user.walletAddress = userDto.walletAddress;
      return await this.userRepository.save(user);
    } catch (err) {
      this.logger.error(
        `userRepository.save failed: ${JSON.stringify(userDto)}`,
        err,
      );
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateEntity(user: UserEntity): Promise<UserEntity> {
    try {
      return await this.userRepository.save(user);
    } catch (err) {
      this.logger.error(`userRepository.save failed: ${user.username}`, err);
      throw new HttpException(
        { message: 'Something went wrong' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
