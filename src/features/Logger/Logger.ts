import { Logger as LoggerAbstraction } from "./abstractions/index.ts";

class ConsoleLogger implements LoggerAbstraction.Interface {
    public info(message: string): void {
        console.log(message);
    }

    public warn(message: string): void {
        console.warn(message);
    }

    public error(message: string): void {
        console.error(message);
    }
}

export const Logger = LoggerAbstraction.createImplementation({
    implementation: ConsoleLogger,
    dependencies: []
});
