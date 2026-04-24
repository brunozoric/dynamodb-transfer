import { Container } from "@webiny/di";
import { LoggerFeature, readLoggerParamsFromEnv } from "~/features/Logger/index.ts";
import type { LogLevel } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { Config, ConfigError, ConfigSchema } from "~/features/Config/index.ts";
import type { ConfigFactory } from "~/features/Config/index.ts";
import { DynamoDbClientFeature } from "~/features/DynamoDbClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { ParseNdJsonErrorHandlerFeature } from "~/features/ParseNdJsonErrorHandler/index.ts";
import { NdJsonLineAccumulatorFeature } from "~/features/NdJsonLineAccumulator/index.ts";
import { RecordModifierFeature } from "~/features/RecordModifier/index.ts";
import { WriteLogMapperFeature } from "~/features/WriteLogMapper/index.ts";
import { SessionFeature } from "~/features/Session/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";
import createExtensions from "@extensions/index.ts";

export async function bootstrap(): Promise<Container> {
    const container = new Container();

    const rawConfig = await readRawConfig();
    const envParams = readLoggerParamsFromEnv(process.env);
    LoggerFeature.register(container, {
        ...envParams,
        logLevel: (rawConfig?.log?.level ?? envParams.logLevel) as LogLevel
    });

    PathsFeature.register(container);
    SessionFeature.register(container);
    PrompterFeature.register(container);
    DynamoDbClientFeature.register(container);
    DownloadFeature.register(container);
    UploadFeature.register(container);
    ParseNdJsonErrorHandlerFeature.register(container);
    NdJsonLineAccumulatorFeature.register(container);
    RecordModifierFeature.register(container);
    WriteLogMapperFeature.register(container);

    await createExtensions({ container });

    CliFeature.register(container);

    const { tables: resolvedTables, log: resolvedLog } = resolveConfig(rawConfig);
    container.registerInstance(Config, {
        load: async () => resolvedTables,
        logSettings: () => resolvedLog
    });

    return container;
}

interface RawConfigResult {
    log?: { level?: string; toFile?: boolean };
    defaults: { awsProfile: string; region: string };
    tables: Array<{
        name: string;
        description: string;
        writable: boolean;
        awsProfile?: string;
        region?: string;
    }>;
}

async function readRawConfig(): Promise<RawConfigResult | null> {
    let factory: ConfigFactory;
    try {
        const mod = await import("../config.js");
        factory = mod.default as ConfigFactory;
    } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND") {
            throw new ConfigError("file not found. Copy config.example.ts to config.ts and edit.");
        }
        throw err;
    }

    const raw = await factory({ container: new Container() });
    const parsed = ConfigSchema.safeParse(raw);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        const path = first ? first.path.map(String).join(".") : "";
        const msg = first
            ? path.length > 0
                ? `${path}: ${first.message}`
                : first.message
            : "invalid config";
        throw new ConfigError(msg);
    }

    return parsed.data as RawConfigResult;
}

interface LoadedConfig {
    tables: Config.ResolvedTable[];
    log: Config.LogSettings | null;
}

function resolveConfig(raw: RawConfigResult | null): LoadedConfig {
    if (!raw) {
        return { tables: [], log: null };
    }
    const { defaults, tables, log } = raw;
    return {
        tables: tables.map(table => ({
            name: table.name,
            description: table.description,
            writable: table.writable,
            awsProfile: table.awsProfile ?? defaults.awsProfile,
            region: table.region ?? defaults.region
        })),
        log: (log ?? null) as Config.LogSettings | null
    };
}
