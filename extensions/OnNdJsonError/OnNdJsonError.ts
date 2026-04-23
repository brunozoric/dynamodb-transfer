import { Logger, ParseNdJsonErrorHandler } from "~/index.js";

const passErrorStartsWith = [
  "Upload failed: Unexpected token",
  "Unterminated string in JSON at position",
  "Unexpected token "
];

class OnNdJsonErrorImpl implements ParseNdJsonErrorHandler.Interface {
  public constructor(private readonly logger: Logger.Interface) {}

  public async handle(
    options: ParseNdJsonErrorHandler.HandleOptions
  ): Promise<Record<string, unknown> | null> {
    const { error, line } = options;

    if (error instanceof Error === false) {
      this.logger.debug(`Not an error: ${typeof error}`);
      this.logger.debug(line);
      return null;
    }
    for (const start of passErrorStartsWith) {
      if (error.message.startsWith(start)) {
        this.logger.info(`Continuing with the error: ${error.message}`);
        return null;
      }
    }
    throw error;
  }
}

export const OnNdJsonError = ParseNdJsonErrorHandler.createImplementation({
  implementation: OnNdJsonErrorImpl,
  dependencies: [Logger]
});
