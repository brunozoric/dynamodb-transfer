import { createAbstraction } from "~/base/index.ts";
import { ConfigSchema, type RawConfig } from "./schema.ts";

export interface IConfig {
    load(): Promise<Config.ResolvedTable[]>;
}

export const Config = createAbstraction<IConfig>("Config/Config");

export namespace Config {
    export type Interface = IConfig;
    export interface ResolvedTable {
        name: string;
        description: string;
        writable: boolean;
        awsProfile: string;
        region: string;
    }
}

export class ConfigError extends Error {
    public constructor(message: string) {
        super(`config.ts: ${message}`);
        this.name = "ConfigError";
    }
}

export function defineConfig(config: RawConfig): RawConfig {
    return config;
}

export { ConfigSchema };
