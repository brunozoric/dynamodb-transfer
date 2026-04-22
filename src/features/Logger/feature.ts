import { createFeature } from "~/base/index.ts";
import { Logger } from "./abstractions/index.ts";
import { PinoLogger } from "./PinoLogger.ts";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LoggerFeatureParams {
    logLevel: LogLevel;
    json: boolean;
}

const VALID_LOG_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>([
    "debug",
    "info",
    "warn",
    "error",
    "silent"
]);

function isLogLevel(value: string | undefined): value is LogLevel {
    return value !== undefined && VALID_LOG_LEVELS.has(value as LogLevel);
}

export function readLoggerParamsFromEnv(env: NodeJS.ProcessEnv): LoggerFeatureParams {
    const envLevel = env.LOG_LEVEL;
    const logLevel: LogLevel = isLogLevel(envLevel) ? envLevel : "info";
    const json = env.LOG_FORMAT === "json";
    return { logLevel, json };
}

export const LoggerFeature = createFeature<LoggerFeatureParams>({
    name: "Core/LoggerFeature",
    register(container, params) {
        const logger = new PinoLogger({
            logLevel: params.logLevel,
            transport: params.json ? "json" : "pretty"
        });
        container.registerInstance(Logger, logger);
    }
});
