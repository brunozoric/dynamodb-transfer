import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { Config, ConfigFeature, ConfigError, ConfigSchema } from "~/features/Config/index.ts";
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
      },
      logSettings: () => null
    };
    container.registerInstance(Config, brokenConfig);
    const config = container.resolve(Config);
    return config.load().catch((err: unknown) => {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).toBe("config.ts: tables: tables must be a non-empty array");
    });
  });
});

function makeValidRawConfig() {
  return {
    defaults: { awsProfile: "dev", region: "us-east-1" },
    tables: [{ name: "my-table", description: "Main table", writable: true }]
  };
}

describe("ConfigSchema", () => {
  it("fails when tables array is empty", () => {
    const result = ConfigSchema.safeParse({ ...makeValidRawConfig(), tables: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]!.message).toBe("tables must be a non-empty array");
    }
  });

  it("fails when the defaults field is missing", () => {
    const { defaults: _defaults, ...config } = makeValidRawConfig();
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(["defaults"]);
    }
  });

  it("fails when two tables share the same name", () => {
    const config = {
      ...makeValidRawConfig(),
      tables: [
        { name: "dup", description: "First table", writable: true },
        { name: "dup", description: "Second table", writable: true }
      ]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      const issue = result.error.issues[0]!;
      expect(issue.message).toBe("duplicate of tables[0].name");
      expect(issue.path).toEqual(["tables", 1, "name"]);
    }
  });

  it("fails when two tables share the same description", () => {
    const config = {
      ...makeValidRawConfig(),
      tables: [
        { name: "table-a", description: "Shared desc", writable: true },
        { name: "table-b", description: "Shared desc", writable: true }
      ]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      const issue = result.error.issues[0]!;
      expect(issue.message).toBe("duplicate of tables[0].description");
      expect(issue.path).toEqual(["tables", 1, "description"]);
    }
  });

  it("fails when a description exceeds 40 characters", () => {
    const config = {
      ...makeValidRawConfig(),
      tables: [{ name: "my-table", description: "A".repeat(41), writable: true }]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]!.message).toBe("description must be 40 characters or fewer");
    }
  });

  it("passes when a table omits awsProfile and region (schema does not require them)", () => {
    const result = ConfigSchema.safeParse(makeValidRawConfig());
    expect(result.success).toBe(true);
  });
});
