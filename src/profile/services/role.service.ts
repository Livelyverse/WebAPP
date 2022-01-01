import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RoleEntity } from '../domain/entity/role.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto, RoleUpdateDto } from '../domain/dto/index.dto';
import { validate } from 'class-validator';
import { IService } from './IService';

@Injectable()
export class RoleService implements IService<RoleEntity> {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async create(roleDto: RoleCreateDto): Promise<RoleEntity> {
    const errors = await validate(roleDto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `create role validation failed, dto: ${JSON.stringify(
          roleDto,
        )}, errors: ${errors}`,
      );

      throw new HttpException(
        { message: 'Input data validation failed', errors },
        HttpStatus.BAD_REQUEST,
      );
    }

    let role = new RoleEntity();
    role.name = roleDto.name.toUpperCase();
    role.description = roleDto.description;

    try {
      role = await this.roleRepository.save(role);
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException(
          'Role name already exists',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return role;
  }

  async deleteByName(name: string): Promise<void> {
    name = name.toUpperCase();
    let deleteResult;
    try {
      deleteResult = await this.roleRepository.softDelete({ name: name });
    } catch (err) {
      this.logger.error(`roleRepository.softDelete failed: ${name}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleteResult.affected) {
      throw new HttpException(
        { message: `Role ${name} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async delete(id: string): Promise<void> {
    let deleteResult;
    try {
      deleteResult = await this.roleRepository.softDelete({ id: id });
    } catch (err) {
      this.logger.error(`roleRepository.softDelete failed: ${id}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleteResult.affected) {
      throw new HttpException(
        { message: `Role ${id} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async findAll(): Promise<Array<RoleEntity>> {
    try {
      return await this.roleRepository.find();
    } catch (err) {
      this.logger.error(`roleRepository.find failed`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findById(id: string): Promise<RoleEntity> {
    let role;
    try {
      role = await this.roleRepository.findOne({ where: { id: id } });
    } catch (err) {
      this.logger.error(`roleRepository.findOne failed. id: ${id}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!role) {
      throw new HttpException(
        { message: `Role ${id} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return role;
  }

  async findByName(name: string): Promise<RoleEntity> {
    name = name.toUpperCase();
    let role;
    try {
      role = await this.roleRepository.findOne({ where: { name: name } });
    } catch (err) {
      this.logger.error(`roleRepository.findOne failed, name: ${name}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!role) {
      throw new HttpException(
        { message: `Role ${name} Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return role;
  }

  async findOne(options: object): Promise<RoleEntity> {
    let role;
    try {
      role = await this.roleRepository.findOne(options);
    } catch (err) {
      this.logger.error(
        `roleRepository.findOne failed, options: ${JSON.stringify(options)}`,
        err,
      );
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!role) {
      throw new HttpException(
        { message: `Role Not Found` },
        HttpStatus.NOT_FOUND,
      );
    }

    return role;
  }

  async update(roleDto: RoleUpdateDto): Promise<RoleEntity> {
    const errors = await validate(roleDto, {
      validationError: { target: false },
      forbidUnknownValues: false,
    });
    if (errors.length > 0) {
      this.logger.log(
        `role update validation failed, dto: ${roleDto}, errors: ${errors}`,
      );
      // const _errors = { username: 'User input is not valid.' };
      throw new HttpException(
        { message: 'Input data validation failed' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const role = await this.roleRepository.findOne({
      where: { name: roleDto.name.toUpperCase() },
    });
    if (!role) {
      this.logger.log(
        `roleRepository.findOne failed, role not found: ${roleDto.name.toUpperCase()}`,
      );
      const errors = { id: 'id not found.' };
      throw new HttpException(
        { message: 'Update profile failed', errors },
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      role.description = roleDto.description;
      return await this.roleRepository.save(role);
    } catch (err) {
      this.logger.error(`roleRepository.save failed: ${roleDto}`, err);
      throw new HttpException(
        { message: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
