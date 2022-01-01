import { Injectable, Logger } from '@nestjs/common';
import { RoleEntity } from '../domain/entity/role.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleCreateDto, RoleUpdateDto } from '../domain/dto/index.dto';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async create(roleDto: RoleCreateDto): Promise<RoleEntity | null> {
    return Promise.resolve(null);
  }

  async update(roleDto: RoleUpdateDto): Promise<RoleEntity | null> {
    return Promise.resolve(null);
  }

  async getOneById(id: string): Promise<RoleEntity | null> {
    return Promise.resolve(null);
  }

  async getOneByName(name: string): Promise<RoleEntity | null> {
    return Promise.resolve(null);
  }

  async getAll(): Promise<RoleEntity[] | null> {
    return Promise.resolve(null);
  }

  async deleteOne(name: string): Promise<boolean> {
    return Promise.resolve(null);
  }
}
