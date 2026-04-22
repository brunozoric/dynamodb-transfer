import { Container } from "@webiny/di";
import { LoggerFeature, readLoggerParamsFromEnv } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { ConfigFeature } from "~/features/Config/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";

export function bootstrap(): Container {
    const container = new Container();
    LoggerFeature.register(container, readLoggerParamsFromEnv(process.env));
    PathsFeature.register(container);
    PrompterFeature.register(container);
    ConfigFeature.register(container);
    AwsClientFeature.register(container);
    DownloadFeature.register(container);
    UploadFeature.register(container);
    CliFeature.register(container);
    return container;
}
