import { BaseEntity } from '../domain/entity';

export interface IService<T extends BaseEntity> {
  findAll(
    offset,
    limit: number,
    sortType,
    sortBy: string,
  ): Promise<{ data: Array<T>; total: number } | null>;

  findTotal(): Promise<number>;

  findById(id: string): Promise<T | null>;

  findByName(name: string): Promise<T | null>;

  findOne(options: object): Promise<T | null>;

  create(dto: object): Promise<T>;

  update(dto: object): Promise<T>;

  delete(id: string): Promise<void>;

  deleteByName(name: string): Promise<void>;
}
