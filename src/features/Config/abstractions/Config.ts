import type { Container } from "@webiny/di";
import { createAbstraction } from "~/base/index.ts";
import { ConfigSchema, type RawConfig } from "./schema.ts";

export interface IConfigFactoryContext {
    container: Container;
}

export type ConfigFactory = (ctx: IConfigFactoryContext) => RawConfig | Promise<RawConfig>;

export interface ILogSettings {
    toFile?: boolean;
    level?: string;
}

export interface IConfig {
    load(): Promise<IResolvedTable[]>;
    logSettings(): ILogSettings | null;
}

export interface IResolvedTable {
    name: string;
    description: string;
    writable: boolean;
    awsProfile: string;
    region: string;
}

export const Config = createAbstraction<IConfig>("Config/Config");

export namespace Config {
    export type Interface = IConfig;
    export type ResolvedTable = IResolvedTable;
    export type LogSettings = ILogSettings;
}

export class ConfigError extends Error {
    public constructor(message: string) {
        super(`config.ts: ${message}`);
        this.name = "ConfigError";
    }
}

export function defineConfig(factory: ConfigFactory): ConfigFactory {
    return factory;
}

export { ConfigSchema };
