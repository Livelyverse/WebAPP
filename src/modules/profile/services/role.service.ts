import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RoleEntity } from '../domain/entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto, RoleUpdateDto } from '../domain/dto';
import { FindAllType, IService, SortType } from "./IService";
import { PostgresErrorCode } from './postgresErrorCode.enum';

export enum RoleSortBy {
  TIMESTAMP = 'createdAt',
  NAME = 'name'
}

@Injectable()
export class RoleService implements IService<RoleEntity> {
  private readonly _logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly _roleRepository: Repository<RoleEntity>,
  ) {}

  async create(roleDto: RoleCreateDto): Promise<RoleEntity> {
    // const errors = await validate(roleDto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `create role validation failed, dto: ${JSON.stringify(
    //       roleDto,
    //     )}, errors: ${errors}`,
    //   );
    //
    //   throw new HttpException(
    //     { message: 'Input data validation failed', errors },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    let role = new RoleEntity();
    role.name = roleDto.name.toUpperCase();
    role.description = roleDto.description;

    try {
      role = await this._roleRepository.save(role);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException({
          statusCode: '400',
          message: 'Role name already exists',
          error: 'Bad Request'
        }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    return role;
  }

  async deleteByName(name: string): Promise<void> {
    name = name.toUpperCase();

    const groupCount = await this._roleRepository
      .createQueryBuilder('role')
      .select('count(*)')
      .innerJoin('role.groups', 'groups')
      .where('role.name = :name', { name: name })
      .groupBy('group.id')
      .getCount();

    if (groupCount > 0) {
      this._logger.warn(`deleteByName role ${name} failed, role has a groups`);
      throw new HttpException({
        statusCode: '422',
        message: `Role ${name} could not delete`,
        error: 'Unprocessable Entity'
      }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let deleteResult;
    try {
      deleteResult = await this._roleRepository.softDelete({ name: name });
    } catch (err) {
      this._logger.error(`_roleRepository.softDelete failed: ${name}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR)
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '404',
        message: `Role ${name} Not Found`,
        error: 'Not Found'
      }, HttpStatus.NOT_FOUND);
    }
  }

  async delete(id: string): Promise<void> {
    const groupCount = await this._roleRepository
      .createQueryBuilder('role')
      .select('count(*)')
      .innerJoin('role.groups', 'groups')
      .where('role.id = :id', { id: id })
      .groupBy('group.id')
      .getCount();

    if (groupCount > 0) {
      this._logger.warn(`delete role ${id} failed, role has a groups`);
      throw new HttpException({
        statusCode: '422',
        message: `Role ${id} could not delete`,
        error: 'Unprocessable Entity'
      }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    let deleteResult;
    try {
      deleteResult = await this._roleRepository.softDelete({ id: id });
    } catch (err) {
      this._logger.error(`_roleRepository.softDelete failed: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!deleteResult.affected) {
      throw new HttpException({
        statusCode: '404',
        message: `Role ${id} Not Found`,
        error: 'Bad Request'
      }, HttpStatus.NOT_FOUND);
    }
  }

  async findTotal(): Promise<number> {
    try {
      return await this._roleRepository.count();
    } catch (err) {
      this._logger.error(`_roleRepository.count failed`, err);
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
    sortBy: RoleSortBy,
  ): Promise<FindAllType<RoleEntity>> {
    try {
      const res = await this._roleRepository.findAndCount({
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
      this._logger.error(`_roleRepository.find failed`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findById(id: string): Promise<RoleEntity | null> {
    try {
      return await this._roleRepository.findOne({ where: { id: id } });
    } catch (err) {
      this._logger.error(`_roleRepository.findOne failed. id: ${id}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    name = name.toUpperCase();
    try {
      return await this._roleRepository.findOne({ where: { name: name } });
    } catch (err) {
      this._logger.error(`_roleRepository.findOne failed, name: ${name}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(options: object): Promise<RoleEntity | null> {
    try {
      return await this._roleRepository.findOne(options);
    } catch (err) {
      this._logger.error(
        `_roleRepository.findOne failed, options: ${JSON.stringify(options)}`,
        err,
      );
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(roleDto: RoleUpdateDto): Promise<RoleEntity> {
    // const errors = await validate(roleDto, {
    //   validationError: { target: false },
    //   forbidUnknownValues: false,
    // });
    // if (errors.length > 0) {
    //   this._logger.log(
    //     `role update validation failed, dto: ${roleDto}, errors: ${errors}`,
    //   );
    //   // const _errors = { username: 'User input is not valid.' };
    //   throw new HttpException(
    //     { message: 'Input data validation failed' },
    //     HttpStatus.BAD_REQUEST,
    //   );
    // }

    const role = await this._roleRepository.findOne({
      where: { id: roleDto.id },
    });
    if (!role) {
      this._logger.log(
        `roleRepository.findOne failed, role not found: ${roleDto.id}`,
      );
      throw new HttpException({
        statusCode: '400',
        message: `Role ${roleDto.id} Not failed`,
        error: 'Not Found'
      }, HttpStatus.BAD_REQUEST);
    }

    try {
      role.description = roleDto.description;
      return await this._roleRepository.save(role);
    } catch (err) {
      this._logger.error(`_roleRepository.save failed: ${roleDto}`, err);
      throw new HttpException({
        statusCode: '500',
        message: 'Something Went Wrong',
        error: 'Internal Server Error'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
