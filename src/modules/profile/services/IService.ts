import { BaseEntity, UserEntity } from "../domain/entity";

export type FindAllType<T extends BaseEntity> = { data: Array<T>; total: number }

export enum SortType {
  ASC = 'ASC',
  DESC = 'DESC'
}

export interface IService<T extends BaseEntity> {
  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: unknown,
  ): Promise<FindAllType<T>>;

  findTotal(): Promise<number>;

  findById(id: string): Promise<T | null>;

  // findByName(name: string): Promise<T | null>;

  findOne(options: object): Promise<T | null>;

  create(dto: object): Promise<T>;

  update(dto: object, entity?: UserEntity): Promise<T>;

  delete(id: string): Promise<void>;

  // deleteByName(name: string): Promise<void>;
}
