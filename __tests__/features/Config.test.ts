import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { Config, ConfigFeature, ConfigError } from "~/features/Config/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";

describe("Config", () => {
  it("returns resolved tables from an injected fake", async () => {
    const container = createTestContainer({
      tables: [
        {
          name: "my-table",
          description: "Production",
          writable: true,
          awsProfile: "prod",
          region: "us-east-1"
        }
      ]
    });
    const config = container.resolve(Config);
    const tables = await config.load();
    expect(tables).toHaveLength(1);
    expect(tables[0]?.name).toBe("my-table");
    expect(tables[0]?.writable).toBe(true);
  });

  it("is registered as a singleton", async () => {
    const container = createTestContainer({ tables: [] });
    const a = container.resolve(Config);
    const b = container.resolve(Config);
    expect(a).toBe(b);
  });

  it("throws ConfigError with a readable prefix when schema validation fails", () => {
    const container = new Container();
    ConfigFeature.register(container);
    const brokenConfig: Config.Interface = {
      load: async () => {
        throw new ConfigError("tables: tables must be a non-empty array");
      }
    };
    container.registerInstance(Config, brokenConfig);
    const config = container.resolve(Config);
    return config.load().catch((err: unknown) => {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).toBe("config.ts: tables: tables must be a non-empty array");
    });
  });
});
