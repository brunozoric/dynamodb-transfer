import { Logger, ParseNdJsonErrorHandler } from "~/index.js";

class OnNdJsonErrorImpl implements ParseNdJsonErrorHandler.Interface {
  public constructor(private readonly logger: Logger.Interface) {}

  public async handle(
    options: ParseNdJsonErrorHandler.HandleOptions
  ): Promise<Record<string, unknown> | null> {
    const { error, line, table } = options;

    if (error instanceof Error === false) {
      this.logger.debug(`Not an error: ${typeof error}`);
      this.logger.debug(line);
      return null;
    }
    const message = error.message;
    if (message.includes("Upload failed: Unterminated string in JSON at position")) {
      return null;
    }

    throw error;
  }
}

export const OnNdJsonError = ParseNdJsonErrorHandler.createImplementation({
  implementation: OnNdJsonErrorImpl,
  dependencies: [Logger]
});
