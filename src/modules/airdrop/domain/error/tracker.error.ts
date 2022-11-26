import { BaseError } from "./base.error";

export class TrackerError extends BaseError {
  constructor(message, cause: Error) {
    super(new.target.name, message, {cause});
  }
}
