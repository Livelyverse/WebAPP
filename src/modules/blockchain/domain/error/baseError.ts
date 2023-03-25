export class BaseError extends Error {
  public readonly name: string;
  public readonly cause: any;

  constructor(name: string, message: string, options = {}) {
    super(message);

    if (options && Object.hasOwn(options, 'cause') && options['cause'] && Object.hasOwn(options['cause'], 'stack')) {
      this.cause = options['cause'];
    } else if (options && Object.hasOwn(options, 'stack') && options['stack']) {
      this.cause = options;
    }
    this.name = name;
  }
}