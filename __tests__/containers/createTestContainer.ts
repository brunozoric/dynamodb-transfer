import { Container } from "@webiny/di";
import { Config, ConfigFeature } from "~/features/Config/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";

export interface TestContainerOptions {
  tables?: Config.ResolvedTable[];
}

export function createTestContainer(options: TestContainerOptions = {}): Container {
  const container = new Container();
  ConfigFeature.register(container);
  AwsClientFeature.register(container);
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
