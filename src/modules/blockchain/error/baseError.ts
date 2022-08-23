export class BaseError extends Error {
  public readonly name: string;
  public readonly cause: any;

  constructor(name: string, message: string, options = {}) {
    super(message);

    for (const [key, value] of Object.entries(options)) {
      if (key === 'cause' && value instanceof Error) {
        this[key as string] = value;
      }
    }

    this.name = name;
  }
}