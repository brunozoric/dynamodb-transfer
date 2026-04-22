// Temporary shim — points old consumers at the relocated schema.
// Removed entirely in the final cleanup task.
export {
    ConfigSchema,
    type RawConfig as Config,
    type RawTableConfig as TableConfig,
    type RawDefaults as Defaults
} from "~/features/Config/abstractions/schema.ts";
export { defineConfig, ConfigError } from "~/features/Config/abstractions/Config.ts";

export interface ResolvedTable {
    name: string;
    description: string;
    writable: boolean;
    awsProfile: string;
    region: string;
}
