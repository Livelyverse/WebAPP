import { BaseEntity } from '../domain/entity/base.entity';

export interface IService<T extends BaseEntity> {
  findAll(): Promise<Array<T>>;

  findById(id: string): Promise<T>;

  findByName(name: string): Promise<T>;

  findOne(options: object): Promise<T>;

  create(dto: object): Promise<T>;

  update(dto: object): Promise<T>;

  delete(id: string): Promise<void>;

  deleteByName(name: string): Promise<void>;
}
