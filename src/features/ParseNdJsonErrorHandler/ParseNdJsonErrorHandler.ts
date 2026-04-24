import { ParseNdJsonErrorHandler as ParseNdJsonErrorHandlerAbstraction } from "./abstractions/index.ts";

class ParseNdJsonErrorHandlerImpl implements ParseNdJsonErrorHandlerAbstraction.Interface {
    public async handle(
        options: ParseNdJsonErrorHandlerAbstraction.HandleOptions
    ): Promise<Record<string, unknown> | null> {
        throw options.error;
    }
}

export const ParseNdJsonErrorHandler = ParseNdJsonErrorHandlerAbstraction.createImplementation({
    implementation: ParseNdJsonErrorHandlerImpl,
    dependencies: []
});
