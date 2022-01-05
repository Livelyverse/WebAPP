import { BaseEntity } from '../domain/entity/base.entity';

export interface IService<T extends BaseEntity> {
  findAll(): Promise<Array<T> | null>;

  findById(id: string): Promise<T | null>;

  findByName(name: string): Promise<T | null>;

  findOne(options: object): Promise<T | null>;

  create(dto: object): Promise<T>;

  update(dto: object): Promise<T>;

  delete(id: string): Promise<void>;

  deleteByName(name: string): Promise<void>;
}
