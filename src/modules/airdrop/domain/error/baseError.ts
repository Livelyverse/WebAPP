export class BaseError extends Error {
  public readonly name: string;
  public readonly code: string;
  public readonly cause: object;

  constructor(name: string, message: string, options = {}) {
    super(message);

    for (const [key, value] of Object.entries(options)) {
      if (key === 'cause' || key === 'code') {
        this[key as string] = value;
      }
    }

    this.name = name;
  }
}