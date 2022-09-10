import { BaseEntity } from "../../profile/domain/entity";
import * as RxJS from "rxjs";
import { SocialType } from "../../profile/domain/entity/socialProfile.entity";

export type FindAllResult<T extends BaseEntity> = { data: Array<T>; total: number }

export interface IAirdropService<T extends BaseEntity> {
  findAll(
    offset: number,
    limit: number,
    sortType: string,
    sortBy: string,
  ): RxJS.Observable< FindAllResult<T>>;

  findTotal(): RxJS.Observable<number>;

  findById(id: string): RxJS.Observable<T>;

  findBySocialType(socialType: SocialType): RxJS.Observable<T>;

  findOne(options: unknown): RxJS.Observable<T>;

  create(dto: object): RxJS.Observable<T>;

  update(dto: object): RxJS.Observable<T>;

  delete(id: string): RxJS.Observable<void>;

  remove(id: string): RxJS.Observable<void>;
}
