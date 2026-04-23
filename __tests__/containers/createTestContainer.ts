import { Container } from "@webiny/di";
import { Config, ConfigFeature } from "~/features/Config/index.ts";
import { LoggerFeature } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { DynamoDbClientFeature } from "~/features/DynamoDbClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";
import { ParseNdJsonErrorHandlerFeature } from "~/features/ParseNdJsonErrorHandler/index.ts";
import { NdJsonLineAccumulatorFeature } from "~/features/NdJsonLineAccumulator/index.ts";

export interface TestContainerOptions {
  tables?: Config.ResolvedTable[];
}

export function createTestContainer(options: TestContainerOptions = {}): Container {
  const container = new Container();
  LoggerFeature.register(container, { logLevel: "silent", json: false });
  PathsFeature.register(container);
  PrompterFeature.register(container);
  ConfigFeature.register(container);
  DynamoDbClientFeature.register(container);
  DownloadFeature.register(container);
  UploadFeature.register(container);
  ParseNdJsonErrorHandlerFeature.register(container);
  NdJsonLineAccumulatorFeature.register(container);
  CliFeature.register(container);
  if (options.tables) {
    container.registerInstance(Config, makeFakeConfig(options.tables));
  }
  return container;
}

function makeFakeConfig(tables: Config.ResolvedTable[]): Config.Interface {
  return {
    load: async () => tables
  };
}
