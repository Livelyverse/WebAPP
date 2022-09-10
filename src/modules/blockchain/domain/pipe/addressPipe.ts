import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform } from "@nestjs/common";
import { ethers } from "ethers";
import { Type } from "@nestjs/common/interfaces";

export interface AddressPipeOptions {
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (error: string) => any;
}

/**
 * Defines the Network Pipe
 * @publicApi
 */
@Injectable()
export class AddressPipe implements PipeTransform<string, Promise<string | null>> {
  protected exceptionFactory: (error: string) => any;

  constructor(@Optional() options?: AddressPipeOptions) {
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
  async transform(value: string, metadata: ArgumentMetadata): Promise<string | null> {
    if (value && !ethers.utils.isAddress(value)) {
      throw this.exceptionFactory(
        'Validation failed (address string is expected)',
      );
    } else if(!value) {
      return null
    }

    return ethers.utils.getAddress(value)
  }
}