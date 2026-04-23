import { Container } from "@webiny/di";
import { LoggerFeature, readLoggerParamsFromEnv } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { Config, ConfigError, ConfigSchema } from "~/features/Config/index.ts";
import type { ConfigFactory } from "~/features/Config/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { ParseNdJsonErrorHandlerFeature } from "~/features/ParseNdJsonErrorHandler/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";
import createExtensions from "@extensions/index.ts";

export async function bootstrap(): Promise<Container> {
    const container = new Container();
    LoggerFeature.register(container, readLoggerParamsFromEnv(process.env));
    PathsFeature.register(container);
    PrompterFeature.register(container);
    AwsClientFeature.register(container);
    DownloadFeature.register(container);
    UploadFeature.register(container);
    ParseNdJsonErrorHandlerFeature.register(container);

    await createExtensions({ container });

    CliFeature.register(container);

    const resolvedTables = await loadConfig(container);
    container.registerInstance(Config, { load: async () => resolvedTables });

    return container;
}

async function loadConfig(container: Container): Promise<Config.ResolvedTable[]> {
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

    const raw = await factory({ container });
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

    const { defaults, tables } = parsed.data;
    return tables.map(table => ({
        name: table.name,
        description: table.description,
        writable: table.writable,
        awsProfile: table.awsProfile ?? defaults.awsProfile,
        region: table.region ?? defaults.region
    }));
}
