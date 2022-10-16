import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserGroupCreateDto, UserGroupUpdateDto } from '../domain/dto';
import { FindAllType, IService, SortType } from "./IService";
import { UserGroupEntity } from '../domain/entity';
import { RoleService } from './role.service';
import { PostgresErrorCode } from './postgresErrorCode.enum';

export enum UserGroupSortBy {
  TIMESTAMP = 'createdAt',
  NAME = 'name'
}

@Injectable()
export class UserGroupService implements IService<UserGroupEntity> {
  private readonly _logger = new Logger(UserGroupService.name);

  constructor(
    @InjectRepository(UserGroupEntity)
    private readonly _userGroupRepository: Repository<UserGroupEntity>,
    private readonly _roleService: RoleService,
  ) {}

  async create(groupDto: UserGroupCreateDto): Promise<UserGroupEntity> {
    // const errors = await validate(groupDto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `create group validation failed, dto: ${JSON.stringify(
    //       groupDto,
    //     )}, errors: ${errors}`,
    //   );
    //
    //   throw new HttpException(
    //     { message: 'Input data validation failed', errors },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    let roleEntity;
    try {
      roleEntity = await this._roleService.findByName(groupDto.role);
    } catch (error) {
      this._logger.error(
        `roleService.findByName failed, role not found: ${groupDto.role}`, error
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!roleEntity) {
      this._logger.log(
        `roleService.findByName failed, role not found: ${groupDto.role}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: `Create UserGroup ${groupDto.name} failed, role ${groupDto.role} not found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    let group = new UserGroupEntity();
    group.name = groupDto.name.toUpperCase();
    group.description = groupDto.description;
    group.role = roleEntity;

    try {
      group = await this._userGroupRepository.save(group);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException({
          statusCode: '400',
          message: 'UserGroup name already exists',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return group;
  }

  async deleteByName(name: string): Promise<void> {
    name = name.toUpperCase();

    const userCount = await this._userGroupRepository
      .createQueryBuilder('group')
      .select('count(*)')
      .innerJoin('group.users', 'user')
      .where('group.name = :name', { name: name })
      .groupBy('user.id')
      .getCount();

    if (userCount > 0) {
      this._logger.error(`delete group ${name} failed, group has a users`);
      throw new HttpException({
        statusCode: '422',
        message: `UserGroup ${name} could not delete`,
        error: 'Unprocessable Entity'
      }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let deleteResult;
    try {
      deleteResult = await this._userGroupRepository.softDelete({ name: name });
    } catch (err) {
      this._logger.error(`_userGroupRepository.softDelete failed: ${name}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '404',
        message: `Group ${name} Not Found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }
  }

  async delete(id: string): Promise<void> {
    const userCount = await this._userGroupRepository
      .createQueryBuilder('group')
      .select('count(*)')
      .innerJoin('group.users', 'user')
      .where('group.id = :id', { id: id })
      .groupBy('user.id')
      .getCount();

    if (userCount > 0) {
      this._logger.error(`deleteByName group ${id} failed, group has a users`);
      throw new HttpException({
        statusCode: '422',
        message: `UserGroup ${id} could not delete`,
        error: 'Unprocessable Entity'
      }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let deleteResult;
    try {
      deleteResult = await this._userGroupRepository.softDelete({ id: id });
    } catch (err) {
      this._logger.error(`_userGroupRepository.softDelete failed: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '404',
        message: `Role ${id} of UserGroup Not Found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }
  }

  async findTotal(): Promise<number> {
    try {
      return await this._userGroupRepository.count();
    } catch (err) {
      this._logger.error(`_userGroupRepository.count failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: UserGroupSortBy,
  ): Promise<FindAllType<UserGroupEntity>> {
    try {
      const res = await this._userGroupRepository.findAndCount({
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortType.toUpperCase(),
        },
      });
      return {
        data: res[0],
        total: res[1],
      };
    } catch (err) {
      this._logger.error(`_userGroupRepository.find failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findById(id: string): Promise<UserGroupEntity | null> {
    try {
      return await this._userGroupRepository.findOne({ where: { id: id } });
    } catch (err) {
      this._logger.error(`_userGroupRepository.findOne failed. id: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findByName(name: string): Promise<UserGroupEntity | null> {
    name = name.toUpperCase();
    try {
      return await this._userGroupRepository.findOne({ where: { name: name } });
    } catch (err) {
      this._logger.error(`_userGroupRepository.findOne failed, name: ${name}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(options: object): Promise<UserGroupEntity | null> {
    try {
      return await this._userGroupRepository.findOne(options);
    } catch (err) {
      this._logger.error(
        `_userGroupRepository.findOne failed, options: ${JSON.stringify(options)}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(groupDto: UserGroupUpdateDto): Promise<UserGroupEntity> {
    // const errors = await validate(groupDto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `group update validation failed, dto: ${groupDto}, errors: ${errors}`,
    //   );
    //   throw new HttpException(
    //     { message: 'Something went wrong' },
    //     HttpStatus.INTERNAL_SERVER_ERROR,
    //   );
    // }

    let group;
    try {
      group = await this._userGroupRepository.findOne({
        where: { name: groupDto.name.toUpperCase() },
      });
    } catch (error) {
      this._logger.error(
        `_userGroupRepository.findOne failed, name: ${groupDto.name}`, error
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!group) {
      this._logger.log(
        `_userGroupRepository.findOne failed, group not found: ${groupDto.name.toUpperCase()}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: `Update UserGroup failed, ${groupDto.name.toUpperCase()} not found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    let roleEntity;
    try {
      roleEntity = await this._roleService.findByName(groupDto.role);
    } catch (error) {
      this._logger.error(
        `roleService.findByName failed, role not found: ${groupDto.role}`, error
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!roleEntity) {
      this._logger.log(
        `roleService.findByName failed, role not found: ${groupDto.role}`,
      );
      throw new HttpException({
        statusCode: '404',
        message: `Update group ${groupDto.name} failed, role ${groupDto.role} not found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }

    try {
      group.description = groupDto.description;
      group.role = roleEntity;
      return await this._userGroupRepository.save(group);
    } catch (err) {
      this._logger.error(
        `_userGroupRepository.save failed: ${JSON.stringify(groupDto)}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
