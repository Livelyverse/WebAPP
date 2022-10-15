import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";
import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
export interface SortByType {
  [index: string]: string
}

export interface SortByPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (error: string) => any;
}

@Injectable()
export class SortByPipe<T extends SortByType> implements PipeTransform<string, Promise<string>> {

  protected exceptionFactory: (error: string) => any;
  protected readonly _sortFields: T

  constructor(sortFields: T, @Optional() options?: SortByPipeOptions) {
    options = options || {};
    this._sortFields = sortFields;
    const { exceptionFactory, errorHttpStatusCode = HttpStatus.BAD_REQUEST } = options;
    this.exceptionFactory = exceptionFactory || (error => new HttpErrorByCode[errorHttpStatusCode](error));
  }

  /**
   * Method that accesses and performs optional transformation on argument for
   * in-flight requests.
   *
   * @param value currently processed route argument
   * @param metadata contains metadata about the currently processed route argument
   */
  async transform(value: string, metadata: ArgumentMetadata): Promise<string> {
    if (value && !this.isSortBy(value)) {
      throw this.exceptionFactory(
        `Validation failed (sortBy string [${Object.keys(this._sortFields).map(value => value.toLowerCase())}] is expected)`,
      );
    } else if(!value) {
      return Object.values(this._sortFields)[0];
    }

    return this._sortFields[value.toUpperCase()];
  }

  /**
   * @param value currently processed route argument
   * @returns `true` if `value` is a valid Sort Type
   */
  protected isSortBy(value: string): boolean {
    return (value.toUpperCase() in this._sortFields);
  }
}