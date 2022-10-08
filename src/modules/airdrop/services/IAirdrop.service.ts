import { BaseEntity } from "../../profile/domain/entity";
import * as RxJS from "rxjs";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";

export type FindAllType<T extends BaseEntity> = { data: Array<T>; total: number }

export enum SortBy {
  TIMESTAMP = 'createdAt',
}

export type SortType = 'ASC' | 'DESC'

export interface IAirdropService<T extends BaseEntity> {
  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: SortBy,
  ): RxJS.Observable<FindAllType<T>>;

  findTotal(): RxJS.Observable<number>;

  findById(id: string): RxJS.Observable<T>;

  find(option: FindOptionsWhere<T>): RxJS.Observable<T[]>;

  findOne(option: FindOptionsWhere<T>): RxJS.Observable<T>;

  create(dto: object): RxJS.Observable<T>;

  update(dto: object): RxJS.Observable<T>;

  delete(id: string): RxJS.Observable<void>;

  remove(id: string): RxJS.Observable<void>;
}
