import { createFeature } from "~/base/index.ts";
import { Logger } from "./abstractions/index.ts";
import { PinoLogger } from "./PinoLogger.ts";

export interface LoggerFeatureParams {
    logLevel: "debug" | "info" | "warn" | "error" | "silent";
    json: boolean;
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
