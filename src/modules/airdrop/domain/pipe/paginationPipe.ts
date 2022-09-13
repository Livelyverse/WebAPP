import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";

export interface PaginationPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (error: string) => any;
}

/**
 * Defines the Pagination Pipe
 *
 *
 * @publicApi
 */
@Injectable()
export class PaginationPipe implements PipeTransform<string, Promise<number>> {
  protected exceptionFactory: (error: string) => any;

  constructor(@Optional() options?: PaginationPipeOptions) {
    options = options || {};
    const { exceptionFactory, errorHttpStatusCode = HttpStatus.BAD_REQUEST } =
      options;

    this.exceptionFactory =
      exceptionFactory ||
      (error => new HttpErrorByCode[errorHttpStatusCode](error));
  }

  /**
   * Method that accesses and performs optional transformation on argument for
   * in-flight requests.
   *
   * @param value currently processed route argument
   * @param metadata contains metadata about the currently processed route argument
   */
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    if (!this.isNumeric(value)) {
      throw this.exceptionFactory(
        'Validation failed (numeric string is expected)',
      );
    }

    let intValue = parseInt(value, 10);

    if (intValue <= 0) {
      throw this.exceptionFactory(
        'Validation failed (numeric must be greater than zero)',
      );
    }

    if (intValue > 100) {
      throw this.exceptionFactory(
        'Validation failed (numeric must be less than 100)',
      );
    }

    return intValue
  }

  /**
   * @param value currently processed route argument
   * @returns `true` if `value` is a valid integer number
   */
  protected isNumeric(value: string): boolean {
    return (
      ['string', 'number'].includes(typeof value) &&
      /^-?\d+$/.test(value) &&
      isFinite(value as any)
    );
  }
}