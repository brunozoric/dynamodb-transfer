import { createAbstraction } from "~/base/index.ts";

export interface ILogger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    fatal(message: string, ...args: unknown[]): void;
    done(message: string): void;
    attachFile(path: string): void;
}

export const Logger = createAbstraction<ILogger>("Core/Logger");

export namespace Logger {
    export type Interface = ILogger;
}
