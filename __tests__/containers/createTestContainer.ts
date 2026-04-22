import { Container } from "@webiny/di";
import { Config, ConfigFeature } from "~/features/Config/index.ts";

export interface TestContainerOptions {
  tables?: Config.ResolvedTable[];
}

export function createTestContainer(options: TestContainerOptions = {}): Container {
  const container = new Container();
  ConfigFeature.register(container);
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
