import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface IParseNdJsonErrorHandler {
    handle(options: IHandleOptions): Promise<Record<string, unknown> | null>;
}

export interface IHandleOptions {
    table: Config.ResolvedTable;
    line: string;
    error: unknown;
}

export const ParseNdJsonErrorHandler = createAbstraction<IParseNdJsonErrorHandler>(
    "Upload/ParseNdJsonErrorHandler"
);

export namespace ParseNdJsonErrorHandler {
    export type Interface = IParseNdJsonErrorHandler;
    export type HandleOptions = IHandleOptions;
}
