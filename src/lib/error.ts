export class CustomError extends Error {
  public suggestion: string | undefined;
  constructor(message: string, options?: { suggestion?: string; cause?: Error }) {
    super(message, { cause: options?.cause });
    this.name = "CustomError";
    if (options?.suggestion) {
      this.suggestion = options.suggestion;
    }
  }
}
