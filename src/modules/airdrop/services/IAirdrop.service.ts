import { BaseEntity } from "../../profile/domain/entity";
import * as RxJS from "rxjs";
import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm/find-options/FindOneOptions";

export type FindAllType<T extends BaseEntity> = { data: Array<T>; total: number }

export enum BalanceSortBy {
  PENDING = 'PENDING',
  SETTLEMENT = 'SETTLEMENT',
  TOTAL = 'TOTAL'
}

export enum SortType {
  ASC = 'ASC',
  DESC = 'DESC'
}

export interface IAirdropService<T extends BaseEntity> {
  findAll(
    offset: number,
    limit: number,
    sortType: SortType,
    sortBy: unknown,
  ): RxJS.Observable<FindAllType<T>>;

  findTotal(): RxJS.Observable<number>;

  findById(id: string): RxJS.Observable<T>;

  find(option: FindManyOptions<T>): RxJS.Observable<T[]>;

  findOne(option: FindOneOptions<T>): RxJS.Observable<T>;

  create(dto: object): RxJS.Observable<T>;

  update(dto: object): RxJS.Observable<T>;

  delete(id: string): RxJS.Observable<void>;

  remove(id: string): RxJS.Observable<void>;
}
