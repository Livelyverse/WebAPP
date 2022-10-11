import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";


export interface ParseBoolPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (error: string) => any;
}

/**
 * Defines the built-in ParseBool Pipe
 *
 * @publicApi
 */
@Injectable()
export class BooleanPipe implements PipeTransform<string | boolean, Promise<boolean | null>>
{
  protected exceptionFactory: (error: string) => any;

  constructor(@Optional() options?: ParseBoolPipeOptions) {
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
  async transform(
    value: string | boolean | null,
    metadata: ArgumentMetadata,
  ): Promise<boolean | null> {
    if(!value) {
      return null;
    }

    if (this.isTrue(value)) {
      return true;
    }
    if (this.isFalse(value)) {
      return false;
    }
    throw this.exceptionFactory(
      'Validation failed (boolean string is expected)',
    );
  }

  /**
   * @param value currently processed route argument
   * @returns `true` if `value` is said 'true', ie., if it is equal to the boolean
   * `true` or the string `"true"`
   */
  protected isTrue(value: string | boolean): boolean {
    return value === true || value === 'true';
  }

  /**
   * @param value currently processed route argument
   * @returns `true` if `value` is said 'false', ie., if it is equal to the boolean
   * `false` or the string `"false"`
   */
  protected isFalse(value: string | boolean): boolean {
    return value === false || value === 'false';
  }
}
