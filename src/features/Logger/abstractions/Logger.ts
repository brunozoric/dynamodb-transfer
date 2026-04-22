import { createAbstraction } from "~/base/index.ts";

export interface ILogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export const Logger = createAbstraction<ILogger>("Core/Logger");

export namespace Logger {
    export type Interface = ILogger;
}
