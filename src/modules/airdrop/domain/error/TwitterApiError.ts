import { ApiPartialResponseError, ApiRequestError, ApiResponseError } from "twitter-api-v2/dist/types/errors.types";
import { BaseError } from "./baseError";

export class TwitterApiError extends BaseError {
  constructor(message, cause: ApiPartialResponseError | ApiRequestError | ApiResponseError) {
    super(new.target.name, message, {cause});
  }
}
