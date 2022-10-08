import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";
import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { SortType } from "../../services/IAirdrop.service";

export interface SortTypePipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (error: string) => any;
}

@Injectable()
export class SortTypePipe implements PipeTransform<string, Promise<SortType>> {

  protected exceptionFactory: (error: string) => any;

  constructor(@Optional() options?: SortTypePipeOptions) {
    options = options || {};
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
  async transform(value: string, metadata: ArgumentMetadata): Promise<SortType> {
    if (value && !this.isSortType(value)) {
      throw this.exceptionFactory(
        'Validation failed (sort type string is expected)',
      );
    } else if(!value) {
      return 'ASC';
    }
    return value.toUpperCase() as SortType
  }

  /**
   * @param value currently processed route argument
   * @returns `true` if `value` is a valid Sort Type
   */
  protected isSortType(value: string): boolean {
    return (['ASC','DESC'].includes(value.toUpperCase()));
  }
}