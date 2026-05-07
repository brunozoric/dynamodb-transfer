import { Config as ConfigAbstraction, ConfigError, ConfigSchema } from "./abstractions/index.ts";

interface ZodIssue {
    path: (string | number | symbol)[];
    message: string;
}

function formatIssue(issue: ZodIssue): string {
    const path = issue.path.map(String).join(".");
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}

async function importUserConfig(): Promise<unknown> {
    const userConfigUrl = new URL("../../../config.js", import.meta.url).href;
    try {
        const mod = (await import(userConfigUrl)) as { default: unknown };
        return mod.default;
    } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND") {
            const defaultMod = await import("../../../config.default.js");
            return defaultMod.default;
        }
        throw err;
    }
}

class ConfigImpl implements ConfigAbstraction.Interface {
    public async load(): Promise<ConfigAbstraction.ResolvedTable[]> {
        const userConfig = await importUserConfig();
        const parsed = ConfigSchema.safeParse(userConfig);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new ConfigError(first ? formatIssue(first) : "invalid config");
        }
        const { defaults, tables } = parsed.data;
        return tables.map(table => ({
            name: table.name,
            description: table.description,
            writable: table.writable,
            awsProfile: table.awsProfile ?? defaults.awsProfile,
            region: table.region ?? defaults.region
        }));
    }

    public logSettings(): ConfigAbstraction.LogSettings | null {
        return null;
    }
}

export const Config = ConfigAbstraction.createImplementation({
    implementation: ConfigImpl,
    dependencies: []
});
