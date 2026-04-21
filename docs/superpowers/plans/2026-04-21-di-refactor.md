# dynamodb-extract DI refactor — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the four core services (Config, AwsClient, Download, Upload) behind `@webiny/di` abstractions while keeping behavior identical. Tests for each new feature land alongside, using `vitest` + `dynalite` (local DynamoDB emulator) + a shared `createTestContainer` harness.

**Architecture:** Each service becomes a feature folder under `src/features/` with the standard layout (`abstractions/`, `<Feature>.ts` impl, `feature.ts`, `index.ts`). A composition root (`src/bootstrap.ts`) registers all four features; `src/index.ts` becomes a thin orchestrator that resolves services from the container and drives the prompt flow. Prompts and pure helpers (`src/lib/paths.ts`) stay as free functions per the spec's deferred-DI scope.

**Tech Stack:** TypeScript (nodenext, strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess), `@webiny/di` ^0.2.3, `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` + `@aws-sdk/credential-providers`, `@inquirer/prompts` ^8.4.2, `zod` ^4, Node 24 ESM, `tsx` runner, `vitest` with `@vitest/coverage-v8` and `vite-tsconfig-paths`, `dynalite` for local DDB integration tests.

**Spec:** `docs/superpowers/specs/2026-04-21-di-refactor-design.md`

**Convention reference:** `docs/webiny-di-guide.md` (updated in commit `ca72f94` to document the short-name reuse + local rename alias convention). Every feature follows that convention.

---

## Global conventions for this plan

- **Abstraction naming:** token + createImplementation export share the same short name (`Config`, `ClientFactory`, `Download`, `Upload`). Impl files use local rename alias: `import { X as XAbstraction } from "./abstractions/index.ts"`. Interface types live on the abstraction namespace (`Config.Interface`, etc.).
- **Area prefix at least two levels:** `"Config/Config"`, `"Config/ConfigFeature"`, `"Aws/ClientFactory"`, `"Aws/AwsClientFeature"`, `"Commands/Download"`, `"Commands/DownloadFeature"`, `"Commands/Upload"`, `"Commands/UploadFeature"`.
- **Method signatures:** options-object style (e.g. `run(options: Download.RunOptions)`), never positional.
- **No inline structural types** in generics, params, returns. Every non-primitive / non-imported type has a named `interface` or `type`.
- **Every class method** has an explicit `public` / `private` / `protected` modifier. Single-line `if` / `for` always with braces.
- **Path alias** `~/* → src/*` is used for all intra-src imports once Task 1 lands.
- **Lifetime:** all four abstractions are registered with `.inSingletonScope()`.
- **Verification cadence per task:** `yarn ts-check && yarn format:check && yarn test` (the test command is added in Task 1; format:check may flag the modified files so run `yarn format:fix` before committing).

---

## File structure at end of plan

```
src/
  base/
    createAbstraction.ts
    createFeature.ts
    index.ts
  features/
    Config/
      abstractions/
        Config.ts
        schema.ts
        index.ts
      Config.ts
      feature.ts
      index.ts
    AwsClient/
      abstractions/
        ClientFactory.ts
        index.ts
      ClientFactory.ts
      feature.ts
      index.ts
    Download/
      abstractions/
        Download.ts
        index.ts
      Download.ts
      feature.ts
      index.ts
    Upload/
      abstractions/
        Upload.ts
        index.ts
      Upload.ts
      feature.ts
      index.ts
  prompts/                           # unchanged (confirmSend renamed to confirmUpload)
  lib/                               # unchanged
  bootstrap.ts
  index.ts                           # rewritten

__tests__/
  setup.ts
  containers/
    createTestContainer.ts
  helpers/
    dynaliteTables.ts
  features/
    Config.test.ts
    AwsClient.test.ts
    Download.test.ts
    Upload.test.ts

vitest.config.ts

config.ts                            # gitignored, unchanged except import path
config.example.ts                    # updated import path

# DELETED (over the course of the plan)
src/aws/
src/commands/
src/config/
```

---

## Task 1: Base infra, vitest + dynalite, path alias

**Files:**
- Create: `src/base/createAbstraction.ts`, `src/base/createFeature.ts`, `src/base/index.ts`
- Create: `vitest.config.ts`, `__tests__/setup.ts`, `__tests__/helpers/dynaliteTables.ts`
- Modify: `tsconfig.json`, `package.json`

### Step 1: Install dev dependencies

- [ ] Run:
  ```sh
  yarn add -D vitest @vitest/coverage-v8 vite-tsconfig-paths dynalite @aws-sdk/util-dynamodb
  ```
  Expected: resolves, updates `package.json` + `yarn.lock`. Latest versions are fine (vitest ^2, coverage-v8 ^2, vite-tsconfig-paths ^5, dynalite ^3, util-dynamodb ^3 — matches the existing `@aws-sdk/*` major).
  - `@aws-sdk/util-dynamodb` is used by `__tests__/helpers/dynaliteTables.ts` for `marshall`/`unmarshall`. It's a transitive of `@aws-sdk/lib-dynamodb` already, but an explicit dev-dep makes the import stable under hoisting changes.

### Step 2: Update `package.json` scripts and format patterns

- [ ] Edit `package.json` `scripts`:
  ```json
  "scripts": {
      "start": "tsx src/index.ts",
      "ts-check": "tsc --noEmit",
      "test": "vitest run --coverage",
      "test:watch": "vitest",
      "format:fix": "oxfmt 'src/**/*.{ts,js}' '__tests__/**/*.ts' 'vitest.config.ts' '.adiorc.js' 'setup-yarnrc.js' 'tsconfig.json' 'config.**'",
      "format:check": "oxfmt --check",
      "postinstall": "yarn set version berry"
  }
  ```
  Specifically: add `test`, add `test:watch`, extend `format:fix` pattern list to include `__tests__/**/*.ts` and `vitest.config.ts`.

### Step 3: Update `tsconfig.json` with path alias

- [ ] Add `baseUrl` and `paths` to `compilerOptions`:
  ```jsonc
  {
      "compilerOptions": {
          // ...existing fields unchanged...
          "baseUrl": ".",
          "paths": {
              "~/*": ["src/*"]
          }
      }
  }
  ```

### Step 4: Create `src/base/createAbstraction.ts`

- [ ] Write:
  ```ts
  import { Abstraction } from "@webiny/di";

  export function createAbstraction<T>(name: string): Abstraction<T> {
      return new Abstraction<T>(name);
  }
  ```

### Step 5: Create `src/base/createFeature.ts`

- [ ] Write:
  ```ts
  import type { Container } from "@webiny/di";

  export interface FeatureDefinition {
      name: string;
      register(container: Container): void;
  }

  export function createFeature(def: FeatureDefinition): FeatureDefinition {
      return def;
  }
  ```

### Step 6: Create `src/base/index.ts`

- [ ] Write:
  ```ts
  export { createAbstraction } from "./createAbstraction.ts";
  export { createFeature, type FeatureDefinition } from "./createFeature.ts";
  ```

### Step 7: Create `__tests__/setup.ts` (vitest globalSetup)

- [ ] Write:
  ```ts
  import dynalite from "dynalite";

  interface DynaliteServer {
      listen(port: number, cb: (err?: Error) => void): void;
      address(): { port: number };
      close(cb: () => void): void;
  }

  let server: DynaliteServer;

  export async function setup(): Promise<void> {
      server = dynalite({ createTableMs: 0, deleteTableMs: 0 }) as DynaliteServer;
      await new Promise<void>((resolve, reject) => {
          server.listen(0, err => (err ? reject(err) : resolve()));
      });
      const port = server.address().port;
      process.env.AWS_ENDPOINT_URL_DYNAMODB = `http://localhost:${port}`;
      process.env.AWS_ACCESS_KEY_ID = "test";
      process.env.AWS_SECRET_ACCESS_KEY = "test";
      process.env.AWS_REGION = "us-east-1";
  }

  export async function teardown(): Promise<void> {
      await new Promise<void>(resolve => {
          server.close(() => resolve());
      });
  }
  ```

### Step 8: Create `__tests__/helpers/dynaliteTables.ts`

- [ ] Write:
  ```ts
  import {
      DynamoDBClient,
      CreateTableCommand,
      DeleteTableCommand,
      BatchWriteItemCommand,
      ScanCommand
  } from "@aws-sdk/client-dynamodb";
  import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
  import { randomUUID } from "node:crypto";

  const client = new DynamoDBClient({});

  export interface TestTableSchema {
      partitionKey: string;
  }

  const DEFAULT_SCHEMA: TestTableSchema = { partitionKey: "PK" };

  export async function createTestTable(
      schema: TestTableSchema = DEFAULT_SCHEMA
  ): Promise<string> {
      const tableName = `test-${randomUUID()}`;
      await client.send(
          new CreateTableCommand({
              TableName: tableName,
              AttributeDefinitions: [
                  { AttributeName: schema.partitionKey, AttributeType: "S" }
              ],
              KeySchema: [
                  { AttributeName: schema.partitionKey, KeyType: "HASH" }
              ],
              BillingMode: "PAY_PER_REQUEST"
          })
      );
      return tableName;
  }

  export async function dropTestTable(tableName: string): Promise<void> {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
  }

  export async function putTestItems(
      tableName: string,
      items: Record<string, unknown>[]
  ): Promise<void> {
      for (let i = 0; i < items.length; i += 25) {
          const chunk = items.slice(i, i + 25);
          await client.send(
              new BatchWriteItemCommand({
                  RequestItems: {
                      [tableName]: chunk.map(item => ({
                          PutRequest: { Item: marshall(item) }
                      }))
                  }
              })
          );
      }
  }

  export async function scanAllItems(
      tableName: string
  ): Promise<Record<string, unknown>[]> {
      const items: Record<string, unknown>[] = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
          const result = await client.send(
              new ScanCommand({ TableName: tableName, ExclusiveStartKey })
          );
          for (const item of result.Items ?? []) {
              items.push(unmarshall(item));
          }
          ExclusiveStartKey = result.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items;
  }
  ```
  Note: uses low-level `DynamoDBClient` directly (not DocumentClient) so the helper is decoupled from `ClientFactory`. `@aws-sdk/util-dynamodb` was installed in Step 1.

### Step 9: Create `vitest.config.ts`

- [ ] Write:
  ```ts
  import { defineConfig } from "vitest/config";
  import tsconfigPaths from "vite-tsconfig-paths";

  export default defineConfig({
      plugins: [tsconfigPaths()],
      test: {
          globalSetup: ["./__tests__/setup.ts"],
          coverage: {
              provider: "v8",
              include: ["src/**/*.ts"],
              exclude: ["src/**/*.d.ts"]
          }
      }
  });
  ```

### Step 10: Smoke-test the test infra

- [ ] Create `__tests__/smoke.test.ts` (temporary; will be deleted at end of Task 1):
  ```ts
  import { describe, it, expect } from "vitest";
  import { createTestTable, dropTestTable, putTestItems, scanAllItems } from "./helpers/dynaliteTables.ts";

  describe("dynalite harness", () => {
      it("creates a table, puts and scans items, drops it", async () => {
          const tableName = await createTestTable();
          try {
              await putTestItems(tableName, [
                  { PK: "a", value: 1 },
                  { PK: "b", value: 2 }
              ]);
              const items = await scanAllItems(tableName);
              expect(items).toHaveLength(2);
              expect(items.find(i => i.PK === "a")?.value).toBe(1);
          } finally {
              await dropTestTable(tableName);
          }
      });
  });
  ```

### Step 11: Verify smoke test passes

- [ ] Run: `yarn test`
  Expected: one test passes, coverage report shows `src/` files at 0% (nothing tested yet, that's fine). Dynalite starts and stops cleanly.

### Step 12: Delete the smoke test

- [ ] Delete `__tests__/smoke.test.ts` — it was only to prove the infra works.

### Step 13: Verify typecheck and format

- [ ] Run: `yarn ts-check`
  Expected: exit 0.
- [ ] Run: `yarn format:fix` (will format new files to project style).
- [ ] Run: `yarn format:check`
  Expected: exit 0.

### Step 14: Commit

- [ ] Run:
  ```bash
  git add package.json yarn.lock tsconfig.json \
          src/base/createAbstraction.ts src/base/createFeature.ts src/base/index.ts \
          __tests__/setup.ts __tests__/helpers/dynaliteTables.ts \
          vitest.config.ts
  git commit -m "$(cat <<'EOF'
  chore(di): base scaffolding, vitest + dynalite, path alias

  Adds src/base/* helpers (createAbstraction, createFeature), tsconfig
  ~/* -> src/* alias, vitest config with coverage and tsconfig-paths
  plugin, __tests__ setup that boots dynalite and injects its endpoint
  via AWS_ENDPOINT_URL_DYNAMODB env var, and a dynalite table helper
  used by later tests. No consumers yet — pure scaffolding.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 2: Config feature

**Files:**
- Create: `src/features/Config/abstractions/schema.ts`
- Create: `src/features/Config/abstractions/Config.ts`
- Create: `src/features/Config/abstractions/index.ts`
- Create: `src/features/Config/Config.ts`
- Create: `src/features/Config/feature.ts`
- Create: `src/features/Config/index.ts`
- Create: `__tests__/containers/createTestContainer.ts` (initial version — just Config registered)
- Create: `__tests__/features/Config.test.ts`
- Modify: `src/config/define.ts` (turn into re-export shim to keep old code working)

### Step 1: Create `src/features/Config/abstractions/schema.ts` (moved zod schema)

- [ ] Write:
  ```ts
  import { z } from "zod";

  const nonEmpty = z.string().min(1);

  export const TableConfigSchema = z.object({
      name: nonEmpty,
      description: nonEmpty.max(40, "description must be 40 characters or fewer"),
      writable: z.boolean(),
      awsProfile: nonEmpty.optional(),
      region: nonEmpty.optional()
  });

  export const DefaultsSchema = z.object({
      awsProfile: nonEmpty,
      region: nonEmpty
  });

  export const ConfigSchema = z
      .object({
          defaults: DefaultsSchema,
          tables: z.array(TableConfigSchema).min(1, "tables must be a non-empty array")
      })
      .superRefine((config, ctx) => {
          const names = new Map<string, number>();
          const descriptions = new Map<string, number>();
          config.tables.forEach((table, i) => {
              const prevName = names.get(table.name);
              if (prevName !== undefined) {
                  ctx.addIssue({
                      code: "custom",
                      path: ["tables", i, "name"],
                      message: `duplicate of tables[${prevName}].name`
                  });
              } else {
                  names.set(table.name, i);
              }
              const prevDesc = descriptions.get(table.description);
              if (prevDesc !== undefined) {
                  ctx.addIssue({
                      code: "custom",
                      path: ["tables", i, "description"],
                      message: `duplicate of tables[${prevDesc}].description`
                  });
              } else {
                  descriptions.set(table.description, i);
              }
          });
      });

  export type RawTableConfig = z.infer<typeof TableConfigSchema>;
  export type RawDefaults = z.infer<typeof DefaultsSchema>;
  export type RawConfig = z.infer<typeof ConfigSchema>;
  ```
  This is a verbatim move of the current `src/config/define.ts` schema, with the `defineConfig` helper pulled out (see next step).

### Step 2: Create `src/features/Config/abstractions/Config.ts`

- [ ] Write:
  ```ts
  import { createAbstraction } from "~/base/index.ts";
  import { ConfigSchema, type RawConfig } from "./schema.ts";

  interface IConfig {
      load(): Promise<Config.ResolvedTable[]>;
  }

  export const Config = createAbstraction<IConfig>("Config/Config");

  export namespace Config {
      export type Interface = IConfig;
      export interface ResolvedTable {
          name: string;
          description: string;
          writable: boolean;
          awsProfile: string;
          region: string;
      }
  }

  export class ConfigError extends Error {
      public constructor(message: string) {
          super(`config.ts: ${message}`);
          this.name = "ConfigError";
      }
  }

  export function defineConfig(config: RawConfig): RawConfig {
      return config;
  }

  export { ConfigSchema };
  ```

### Step 3: Create `src/features/Config/abstractions/index.ts`

- [ ] Write:
  ```ts
  export { Config, ConfigError, defineConfig, ConfigSchema } from "./Config.ts";
  ```
  Note: `ConfigError` and `defineConfig` are re-exported here because they're user-facing surface (`defineConfig` is imported by the root `config.ts`; `ConfigError` is thrown by `ConfigImpl`). They're re-exported from the feature's `index.ts` via this barrel.

### Step 4: Create `src/features/Config/Config.ts` (ConfigImpl)

- [ ] Write:
  ```ts
  import {
      Config as ConfigAbstraction,
      ConfigError,
      ConfigSchema
  } from "./abstractions/index.ts";

  interface ZodIssue {
      path: (string | number | symbol)[];
      message: string;
  }

  function formatIssue(issue: ZodIssue): string {
      const path = issue.path.map(String).join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  }

  async function importUserConfig(): Promise<unknown> {
      try {
          const mod = await import("../../../config.js");
          return mod.default;
      } catch (err) {
          if (err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND") {
              throw new ConfigError(
                  "file not found. Copy config.example.ts to config.ts and edit."
              );
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
  }

  export const Config = ConfigAbstraction.createImplementation({
      implementation: ConfigImpl,
      dependencies: []
  });
  ```
  The dynamic import path `"../../../config.js"` goes from `src/features/Config/Config.ts` back up to the repo root `config.js`. At runtime tsx resolves `.js` → `.ts` automatically.

### Step 5: Create `src/features/Config/feature.ts`

- [ ] Write:
  ```ts
  import { createFeature } from "~/base/index.ts";
  import { Config } from "./Config.ts";

  export const ConfigFeature = createFeature({
      name: "Config/ConfigFeature",
      register(container) {
          container.register(Config).inSingletonScope();
      }
  });
  ```

### Step 6: Create `src/features/Config/index.ts` (public surface)

- [ ] Write:
  ```ts
  export {
      Config,
      ConfigError,
      defineConfig
  } from "./abstractions/index.ts";
  export { ConfigFeature } from "./feature.ts";
  ```

### Step 7: Replace `src/config/define.ts` with a re-export shim

- [ ] Overwrite `src/config/define.ts` with:
  ```ts
  // Temporary shim — points old consumers at the relocated schema.
  // Removed entirely in the final cleanup task.
  export {
      ConfigSchema,
      type RawConfig as Config,
      type RawTableConfig as TableConfig,
      type RawDefaults as Defaults
  } from "~/features/Config/abstractions/schema.ts";
  export {
      defineConfig,
      ConfigError
  } from "~/features/Config/abstractions/Config.ts";

  export interface ResolvedTable {
      name: string;
      description: string;
      writable: boolean;
      awsProfile: string;
      region: string;
  }
  ```
  This preserves every import the old `src/config/load.ts`, root `config.ts`, and `src/commands/*.ts` are currently using. `config.ts` keeps importing `defineConfig` from `./src/config/define.js` and still works.

### Step 8: Create `__tests__/containers/createTestContainer.ts` (Config-only initial version)

- [ ] Write:
  ```ts
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
  ```
  Later tasks will extend this helper to register the other features as they come online.

### Step 9: Create `__tests__/features/Config.test.ts`

- [ ] Write:
  ```ts
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
              expect((err as Error).message).toBe(
                  "config.ts: tables: tables must be a non-empty array"
              );
          });
      });
  });
  ```
  The third test exercises `ConfigError` directly since `ConfigImpl`'s real behavior depends on a file at the project root — testing that path would conflict with the actual user `config.ts`. The real impl is exercised via `yarn start` smoke tests in Task 6.

### Step 10: Run tests and typecheck

- [ ] Run: `yarn ts-check`
  Expected: exit 0. (Old `src/config/load.ts` still imports from the shimmed `src/config/define.ts` — the re-exports make it continue to typecheck.)
- [ ] Run: `yarn test`
  Expected: Config suite passes (3 tests). Coverage now shows `src/features/Config/*` with meaningful numbers.
- [ ] Run: `yarn format:fix && yarn format:check`
  Expected: exit 0.

### Step 11: Commit

- [ ] Run:
  ```bash
  git add src/features/Config/ src/config/define.ts \
          __tests__/containers/createTestContainer.ts \
          __tests__/features/Config.test.ts
  git commit -m "$(cat <<'EOF'
  feat(di): Config feature

  Introduces the Config abstraction + impl + feature under
  src/features/Config/. The zod schema moves to
  abstractions/schema.ts; defineConfig and ConfigError move to
  abstractions/Config.ts. Old src/config/define.ts becomes a
  re-export shim so the still-live src/config/load.ts and
  src/commands/*.ts keep working until later tasks replace them.

  Adds the createTestContainer harness and unit tests for Config
  using a registerInstance override.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 3: AwsClient feature

**Files:**
- Create: `src/features/AwsClient/abstractions/ClientFactory.ts`, `index.ts`
- Create: `src/features/AwsClient/ClientFactory.ts`
- Create: `src/features/AwsClient/feature.ts`
- Create: `src/features/AwsClient/index.ts`
- Create: `__tests__/features/AwsClient.test.ts`
- Modify: `__tests__/containers/createTestContainer.ts` (add AwsClientFeature registration)

### Step 1: Create `src/features/AwsClient/abstractions/ClientFactory.ts`

- [ ] Write:
  ```ts
  import { createAbstraction } from "~/base/index.ts";
  import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
  import type { Config } from "~/features/Config/index.ts";

  interface IClientFactory {
      create(table: Config.ResolvedTable): ClientFactory.Client;
  }

  export const ClientFactory = createAbstraction<IClientFactory>("Aws/ClientFactory");

  export namespace ClientFactory {
      export type Interface = IClientFactory;
      export type Client = DynamoDBDocumentClient;
  }
  ```

### Step 2: Create `src/features/AwsClient/abstractions/index.ts`

- [ ] Write:
  ```ts
  export { ClientFactory } from "./ClientFactory.ts";
  ```

### Step 3: Create `src/features/AwsClient/ClientFactory.ts` (impl)

- [ ] Write:
  ```ts
  import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
  import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
  import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
  import type { Config } from "~/features/Config/index.ts";
  import { ClientFactory as ClientFactoryAbstraction } from "./abstractions/index.ts";

  class ClientFactoryImpl implements ClientFactoryAbstraction.Interface {
      public create(table: Config.ResolvedTable): ClientFactoryAbstraction.Client {
          return DynamoDBDocumentClient.from(
              new DynamoDBClient({
                  region: table.region,
                  credentials: fromNodeProviderChain({ profile: table.awsProfile })
              })
          );
      }
  }

  export const ClientFactory = ClientFactoryAbstraction.createImplementation({
      implementation: ClientFactoryImpl,
      dependencies: []
  });
  ```

### Step 4: Create `src/features/AwsClient/feature.ts`

- [ ] Write:
  ```ts
  import { createFeature } from "~/base/index.ts";
  import { ClientFactory } from "./ClientFactory.ts";

  export const AwsClientFeature = createFeature({
      name: "Aws/AwsClientFeature",
      register(container) {
          container.register(ClientFactory).inSingletonScope();
      }
  });
  ```

### Step 5: Create `src/features/AwsClient/index.ts`

- [ ] Write:
  ```ts
  export { ClientFactory } from "./abstractions/index.ts";
  export { AwsClientFeature } from "./feature.ts";
  ```

### Step 6: Extend `createTestContainer` to register AwsClient

- [ ] Edit `__tests__/containers/createTestContainer.ts`:
  ```ts
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
  ```

### Step 7: Create `__tests__/features/AwsClient.test.ts` (smoke test against dynalite)

- [ ] Write:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { ScanCommand } from "@aws-sdk/lib-dynamodb";
  import { ClientFactory } from "~/features/AwsClient/index.ts";
  import { createTestContainer } from "../containers/createTestContainer.ts";
  import { createTestTable, dropTestTable } from "../helpers/dynaliteTables.ts";

  describe("ClientFactory", () => {
      const tablesToClean: string[] = [];
      afterEach(async () => {
          while (tablesToClean.length > 0) {
              const name = tablesToClean.pop();
              if (name !== undefined) {
                  await dropTestTable(name);
              }
          }
      });

      it("creates a client that can scan a dynalite table", async () => {
          const container = createTestContainer();
          const factory = container.resolve(ClientFactory);

          const tableName = await createTestTable();
          tablesToClean.push(tableName);

          const client = factory.create({
              name: tableName,
              description: "Test",
              writable: true,
              awsProfile: "test",
              region: "us-east-1"
          });

          const result = await client.send(new ScanCommand({ TableName: tableName }));
          expect(result.Items).toEqual([]);
      });

      it("is registered as a singleton", () => {
          const container = createTestContainer();
          const a = container.resolve(ClientFactory);
          const b = container.resolve(ClientFactory);
          expect(a).toBe(b);
      });
  });
  ```

### Step 8: Verify

- [ ] Run: `yarn ts-check` → exit 0.
- [ ] Run: `yarn test` → AwsClient (2 tests) + Config (3 tests) all pass.
- [ ] Run: `yarn format:fix && yarn format:check` → exit 0.

### Step 9: Commit

- [ ] Run:
  ```bash
  git add src/features/AwsClient/ \
          __tests__/containers/createTestContainer.ts \
          __tests__/features/AwsClient.test.ts
  git commit -m "$(cat <<'EOF'
  feat(di): AwsClient feature

  ClientFactory abstraction backed by DynamoDBDocumentClient +
  fromNodeProviderChain. No dependencies; stateless singleton.
  Smoke test runs a real Scan against dynalite to prove the
  factory yields a usable client. Old src/aws/client.ts untouched;
  it gets deleted in the final cleanup task.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 4: Download feature

**Files:**
- Create: `src/features/Download/abstractions/Download.ts`, `index.ts`
- Create: `src/features/Download/Download.ts`
- Create: `src/features/Download/feature.ts`
- Create: `src/features/Download/index.ts`
- Create: `__tests__/features/Download.test.ts`
- Modify: `__tests__/containers/createTestContainer.ts` (add DownloadFeature)
- Modify: `src/index.ts` (route download action through container-resolved Download)
- Delete: `src/commands/download.ts`

### Step 1: Create `src/features/Download/abstractions/Download.ts`

- [ ] Write:
  ```ts
  import { createAbstraction } from "~/base/index.ts";
  import type { Config } from "~/features/Config/index.ts";
  import type { DownloadFormat } from "~/lib/paths.ts";

  interface IDownload {
      run(options: Download.RunOptions): Promise<void>;
  }

  export const Download = createAbstraction<IDownload>("Commands/Download");

  export namespace Download {
      export type Interface = IDownload;
      export interface RunOptions {
          table: Config.ResolvedTable;
          destPath: string;
          format: DownloadFormat;
          segments: number;
      }
  }
  ```

### Step 2: Create `src/features/Download/abstractions/index.ts`

- [ ] Write:
  ```ts
  export { Download } from "./Download.ts";
  ```

### Step 3: Create `src/features/Download/Download.ts` (impl)

- [ ] Write:
  ```ts
  import { ScanCommand } from "@aws-sdk/lib-dynamodb";
  import { createWriteStream, writeFileSync } from "node:fs";
  import type { WriteStream } from "node:fs";
  import { ClientFactory } from "~/features/AwsClient/index.ts";
  import { Download as DownloadAbstraction } from "./abstractions/index.ts";

  class DownloadImpl implements DownloadAbstraction.Interface {
      public constructor(private readonly clientFactory: ClientFactory.Interface) {}

      public async run(options: DownloadAbstraction.RunOptions): Promise<void> {
          const { table, destPath, format, segments } = options;
          const client = this.clientFactory.create(table);
          try {
              if (format === "ndjson") {
                  await this.downloadNdjson(client, table.name, destPath, segments);
              } else {
                  await this.downloadJson(client, table.name, destPath);
              }
          } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              throw new Error(`Download failed: ${message}`);
          }
      }

      private async downloadJson(
          client: ClientFactory.Client,
          tableName: string,
          destPath: string
      ): Promise<void> {
          const items: Record<string, unknown>[] = [];
          let ExclusiveStartKey: Record<string, unknown> | undefined;
          do {
              const result = await client.send(
                  new ScanCommand({ TableName: tableName, ExclusiveStartKey })
              );
              items.push(...(result.Items ?? []));
              ExclusiveStartKey = result.LastEvaluatedKey;
              console.log(`Scanned ${items.length} items...`);
          } while (ExclusiveStartKey);

          writeFileSync(destPath, JSON.stringify(items, null, 2));
          console.log(`Exported ${items.length} items to ${destPath}`);
      }

      private async downloadNdjson(
          client: ClientFactory.Client,
          tableName: string,
          destPath: string,
          segments: number
      ): Promise<void> {
          const stream = createWriteStream(destPath);
          let total = 0;

          const worker = async (segment: number): Promise<void> => {
              let ExclusiveStartKey: Record<string, unknown> | undefined;
              do {
                  const result = await client.send(
                      new ScanCommand({
                          TableName: tableName,
                          Segment: segment,
                          TotalSegments: segments,
                          ExclusiveStartKey
                      })
                  );
                  for (const item of result.Items ?? []) {
                      await this.writeLine(stream, JSON.stringify(item) + "\n");
                  }
                  total += result.Items?.length ?? 0;
                  ExclusiveStartKey = result.LastEvaluatedKey;
                  console.log(
                      segments > 1
                          ? `Scanned ${total} items... (seg ${segment})`
                          : `Scanned ${total} items...`
                  );
              } while (ExclusiveStartKey);
          };

          try {
              await Promise.all(
                  Array.from({ length: segments }, (_, i) => worker(i))
              );
          } finally {
              await this.closeStream(stream);
          }
          console.log(`Exported ${total} items to ${destPath}`);
      }

      private writeLine(stream: WriteStream, line: string): Promise<void> {
          return new Promise((resolve, reject) => {
              const ok = stream.write(line, err => {
                  if (err) {
                      reject(err);
                  }
              });
              if (ok) {
                  resolve();
              } else {
                  stream.once("drain", resolve);
              }
          });
      }

      private closeStream(stream: WriteStream): Promise<void> {
          return new Promise((resolve, reject) => {
              stream.once("finish", () => resolve());
              stream.once("error", reject);
              stream.end();
          });
      }
  }

  export const Download = DownloadAbstraction.createImplementation({
      implementation: DownloadImpl,
      dependencies: [ClientFactory]
  });
  ```

### Step 4: Create `src/features/Download/feature.ts`

- [ ] Write:
  ```ts
  import { createFeature } from "~/base/index.ts";
  import { Download } from "./Download.ts";

  export const DownloadFeature = createFeature({
      name: "Commands/DownloadFeature",
      register(container) {
          container.register(Download).inSingletonScope();
      }
  });
  ```

### Step 5: Create `src/features/Download/index.ts`

- [ ] Write:
  ```ts
  export { Download } from "./abstractions/index.ts";
  export { DownloadFeature } from "./feature.ts";
  ```

### Step 6: Extend `createTestContainer`

- [ ] Edit `__tests__/containers/createTestContainer.ts`:
  ```ts
  import { Container } from "@webiny/di";
  import { Config, ConfigFeature } from "~/features/Config/index.ts";
  import { AwsClientFeature } from "~/features/AwsClient/index.ts";
  import { DownloadFeature } from "~/features/Download/index.ts";

  export interface TestContainerOptions {
      tables?: Config.ResolvedTable[];
  }

  export function createTestContainer(options: TestContainerOptions = {}): Container {
      const container = new Container();
      ConfigFeature.register(container);
      AwsClientFeature.register(container);
      DownloadFeature.register(container);
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
  ```

### Step 7: Create `__tests__/features/Download.test.ts`

- [ ] Write:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { mkdirSync, readFileSync, rmSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { randomUUID } from "node:crypto";
  import { Download } from "~/features/Download/index.ts";
  import type { Config } from "~/features/Config/index.ts";
  import { createTestContainer } from "../containers/createTestContainer.ts";
  import { createTestTable, dropTestTable, putTestItems } from "../helpers/dynaliteTables.ts";

  const makeTable = (name: string): Config.ResolvedTable => ({
      name,
      description: "Test table",
      writable: true,
      awsProfile: "test",
      region: "us-east-1"
  });

  function makeTmpDir(): string {
      const dir = join(tmpdir(), `ddbx-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      return dir;
  }

  describe("Download", () => {
      const tablesToClean: string[] = [];
      const dirsToClean: string[] = [];

      afterEach(async () => {
          while (tablesToClean.length > 0) {
              const name = tablesToClean.pop();
              if (name !== undefined) {
                  await dropTestTable(name);
              }
          }
          while (dirsToClean.length > 0) {
              const dir = dirsToClean.pop();
              if (dir !== undefined) {
                  rmSync(dir, { recursive: true, force: true });
              }
          }
      });

      it("writes NDJSON line-per-item with 1 segment", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          await putTestItems(tableName, [
              { PK: "a", value: 1 },
              { PK: "b", value: 2 },
              { PK: "c", value: 3 }
          ]);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const destPath = join(dir, "out.ndjson");

          const container = createTestContainer();
          const download = container.resolve(Download);
          await download.run({
              table: makeTable(tableName),
              destPath,
              format: "ndjson",
              segments: 1
          });

          const contents = readFileSync(destPath, "utf-8");
          const lines = contents.split("\n").filter(Boolean);
          expect(lines).toHaveLength(3);
          const parsed = lines.map(l => JSON.parse(l) as Record<string, unknown>);
          expect(parsed.map(p => p.PK).sort()).toEqual(["a", "b", "c"]);
      });

      it("writes NDJSON with multiple segments and captures every item", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          const items = Array.from({ length: 50 }, (_, i) => ({
              PK: `k${i}`,
              value: i
          }));
          await putTestItems(tableName, items);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const destPath = join(dir, "out.ndjson");

          const container = createTestContainer();
          const download = container.resolve(Download);
          await download.run({
              table: makeTable(tableName),
              destPath,
              format: "ndjson",
              segments: 4
          });

          const lines = readFileSync(destPath, "utf-8").split("\n").filter(Boolean);
          expect(lines).toHaveLength(50);
          const keys = lines.map(l => (JSON.parse(l) as { PK: string }).PK);
          expect(new Set(keys).size).toBe(50);
      });

      it("writes pretty-printed JSON array with 1 segment", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          await putTestItems(tableName, [{ PK: "a", value: 1 }]);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const destPath = join(dir, "out.json");

          const container = createTestContainer();
          const download = container.resolve(Download);
          await download.run({
              table: makeTable(tableName),
              destPath,
              format: "json",
              segments: 1
          });

          const parsed = JSON.parse(readFileSync(destPath, "utf-8")) as Array<Record<string, unknown>>;
          expect(parsed).toHaveLength(1);
          expect(parsed[0]?.PK).toBe("a");
      });

      it("wraps errors with 'Download failed:' prefix", async () => {
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const destPath = join(dir, "out.ndjson");

          const container = createTestContainer();
          const download = container.resolve(Download);
          await expect(
              download.run({
                  table: makeTable("does-not-exist-table"),
                  destPath,
                  format: "ndjson",
                  segments: 1
              })
          ).rejects.toThrowError(/^Download failed:/);
      });
  });
  ```

### Step 8: Delete the old `src/commands/download.ts`

- [ ] Run: `git rm src/commands/download.ts`

### Step 9: Route `src/index.ts` through the container for the download branch (partial orchestrator update)

- [ ] Edit `src/index.ts` — at this stage only the download branch switches over. The upload branch still calls the old `runSend`. Replace the top of the file + the download branch only:
  ```ts
  import { confirm } from "@inquirer/prompts";
  import { Container } from "@webiny/di";
  import { Config, ConfigFeature } from "~/features/Config/index.ts";
  import { AwsClientFeature } from "~/features/AwsClient/index.ts";
  import { Download, DownloadFeature } from "~/features/Download/index.ts";
  import { runSend } from "./commands/send.ts";
  import { dataFilePath, extensionFor } from "./lib/paths.js";
  import { promptAction } from "./prompts/action.js";
  import { confirmSend } from "./prompts/confirmSend.js";
  import { promptDownloadFormat } from "./prompts/downloadFormat.js";
  import { resolveDestPath } from "./prompts/overwrite.js";
  import { promptSegments } from "./prompts/segments.js";
  import { promptSourceFile } from "./prompts/sourceFile.js";
  import { promptTable } from "./prompts/table.js";

  const container = new Container();
  ConfigFeature.register(container);
  AwsClientFeature.register(container);
  DownloadFeature.register(container);
  const config = container.resolve(Config);
  const download = container.resolve(Download);

  const main = async (): Promise<void> => {
      const tables = await config.load();
      const action = await promptAction();

      if (action === "exit") return;

      if (action === "download") {
          const table = await promptTable(tables, "Which table do you want to download?");
          const segments = await promptSegments();
          const format = await promptDownloadFormat(segments);
          const initialPath = dataFilePath(table.description, format);
          const destPath = await resolveDestPath(initialPath, extensionFor(format));
          if (destPath === null) return;
          await download.run({ table, destPath, format, segments });
          return;
      }

      // action === "send" — still on the old path until Task 5
      const writableTables = tables.filter(t => t.writable);
      if (writableTables.length === 0) {
          console.log(
              "No writable tables in config.ts. Set `writable: true` on the table you want to send to."
          );
          return;
      }
      const sourcePath = await promptSourceFile();
      if (sourcePath === null) {
          console.log("No files in data/ to send.");
          return;
      }
      const table = await promptTable(writableTables, "Which table should receive the data?");
      await confirmSend(sourcePath, table);
      await runSend(sourcePath, table);
  };

  try {
      await main();
  } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
          process.exit(0);
      }
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
  }
  ```
  Bootstrap logic is inlined temporarily; gets extracted to `src/bootstrap.ts` in Task 6. Old `confirm` import removed (no longer used after the write path still uses `confirmSend`, which internally uses its own `@inquirer/prompts` imports).

### Step 10: Verify

- [ ] Run: `yarn ts-check` → exit 0. The old `src/commands/send.ts` still compiles because it still imports from the shimmed `src/config/define.ts`.
- [ ] Run: `yarn test` → Config (3) + AwsClient (2) + Download (4) all pass.
- [ ] Run: `yarn format:fix && yarn format:check` → exit 0.
- [ ] Manual boot smoke test:
  ```sh
  ( yarn start & PID=$!; sleep 2; kill -INT $PID 2>/dev/null; wait $PID 2>/dev/null ) 2>&1 | head -10
  ```
  Expected: action menu renders with the three choices.

### Step 11: Commit

- [ ] Run:
  ```bash
  git add src/features/Download/ src/index.ts \
          __tests__/containers/createTestContainer.ts \
          __tests__/features/Download.test.ts
  git commit -m "$(cat <<'EOF'
  feat(di): Download feature

  Introduces Commands/Download behind a DI abstraction. Impl depends
  on ClientFactory and carries the full current download behavior
  (paginated scan or parallel-segment scan, NDJSON streaming or
  pretty JSON array, identical error wrapping).

  src/index.ts inlines a temporary bootstrap for Config + AwsClient
  + Download and routes the download branch through the container.
  The upload branch still uses the old runSend until Task 5 rebuilds
  it as a feature. Deletes src/commands/download.ts.

  Integration tests run against dynalite — one per format / segment
  variant, plus an error-path assertion for the 'Download failed:'
  prefix.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 5: Upload feature (Send → Upload rename)

**Files:**
- Create: `src/features/Upload/abstractions/Upload.ts`, `index.ts`
- Create: `src/features/Upload/Upload.ts`
- Create: `src/features/Upload/feature.ts`
- Create: `src/features/Upload/index.ts`
- Create: `__tests__/features/Upload.test.ts`
- Modify: `__tests__/containers/createTestContainer.ts` (add UploadFeature)
- Modify: `src/prompts/action.ts` (label change)
- Create: `src/prompts/confirmUpload.ts` (renamed from confirmSend)
- Delete: `src/prompts/confirmSend.ts`
- Modify: `src/index.ts` (route upload branch through container, remove old runSend import)
- Delete: `src/commands/send.ts`

### Step 1: Create `src/features/Upload/abstractions/Upload.ts`

- [ ] Write:
  ```ts
  import { createAbstraction } from "~/base/index.ts";
  import type { Config } from "~/features/Config/index.ts";

  interface IUpload {
      run(options: Upload.RunOptions): Promise<void>;
  }

  export const Upload = createAbstraction<IUpload>("Commands/Upload");

  export namespace Upload {
      export type Interface = IUpload;
      export interface RunOptions {
          sourcePath: string;
          table: Config.ResolvedTable;
      }
  }
  ```

### Step 2: Create `src/features/Upload/abstractions/index.ts`

- [ ] Write:
  ```ts
  export { Upload } from "./Upload.ts";
  ```

### Step 3: Create `src/features/Upload/Upload.ts` (impl)

- [ ] Write:
  ```ts
  import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
  import type {
      BatchWriteCommandInput,
      BatchWriteCommandOutput
  } from "@aws-sdk/lib-dynamodb";
  import { createReadStream, readFileSync } from "node:fs";
  import { createInterface } from "node:readline";
  import { ClientFactory } from "~/features/AwsClient/index.ts";
  import { detectFormat } from "~/lib/paths.ts";
  import { Upload as UploadAbstraction } from "./abstractions/index.ts";

  const CHUNK_SIZE = 25;
  const BACKOFF_MS = 500;

  class UploadImpl implements UploadAbstraction.Interface {
      public constructor(private readonly clientFactory: ClientFactory.Interface) {}

      public async run(options: UploadAbstraction.RunOptions): Promise<void> {
          const { sourcePath, table } = options;
          const client = this.clientFactory.create(table);
          const format = detectFormat(sourcePath);
          try {
              if (format === "ndjson") {
                  await this.sendNdjson(client, table.name, sourcePath);
              } else if (format === "json") {
                  await this.sendJson(client, table.name, sourcePath);
              } else {
                  throw new Error(`Unknown file format for ${sourcePath}`);
              }
          } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              throw new Error(`Upload failed: ${message}`);
          }
      }

      private async sendJson(
          client: ClientFactory.Client,
          tableName: string,
          sourcePath: string
      ): Promise<void> {
          const items = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>[];
          let written = 0;
          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
              const chunk = items.slice(i, i + CHUNK_SIZE);
              await this.sendChunk(client, tableName, chunk);
              written += chunk.length;
              console.log(`Written ${written}/${items.length}`);
          }
          console.log(`Wrote ${items.length} items to ${tableName}`);
      }

      private async sendNdjson(
          client: ClientFactory.Client,
          tableName: string,
          sourcePath: string
      ): Promise<void> {
          const rl = createInterface({
              input: createReadStream(sourcePath),
              crlfDelay: Infinity
          });

          let buffer: Record<string, unknown>[] = [];
          let written = 0;
          for await (const line of rl) {
              if (line.trim().length === 0) continue;
              buffer.push(JSON.parse(line) as Record<string, unknown>);
              if (buffer.length >= CHUNK_SIZE) {
                  await this.sendChunk(client, tableName, buffer);
                  written += buffer.length;
                  console.log(`Written ${written} items...`);
                  buffer = [];
              }
          }
          if (buffer.length > 0) {
              await this.sendChunk(client, tableName, buffer);
              written += buffer.length;
          }
          console.log(`Wrote ${written} items to ${tableName}`);
      }

      private async sendChunk(
          client: ClientFactory.Client,
          tableName: string,
          chunk: Record<string, unknown>[]
      ): Promise<void> {
          let unprocessed: BatchWriteCommandInput["RequestItems"] = {
              [tableName]: chunk.map(Item => ({ PutRequest: { Item } }))
          };
          while (unprocessed !== undefined && Object.keys(unprocessed).length > 0) {
              const requestItems: BatchWriteCommandInput["RequestItems"] = unprocessed;
              const result: BatchWriteCommandOutput = await client.send(
                  new BatchWriteCommand({ RequestItems: requestItems })
              );
              unprocessed =
                  result.UnprocessedItems &&
                  Object.keys(result.UnprocessedItems).length > 0
                      ? result.UnprocessedItems
                      : undefined;
              if (unprocessed) {
                  await new Promise(r => setTimeout(r, BACKOFF_MS));
              }
          }
      }
  }

  export const Upload = UploadAbstraction.createImplementation({
      implementation: UploadImpl,
      dependencies: [ClientFactory]
  });
  ```

### Step 4: Create `src/features/Upload/feature.ts`

- [ ] Write:
  ```ts
  import { createFeature } from "~/base/index.ts";
  import { Upload } from "./Upload.ts";

  export const UploadFeature = createFeature({
      name: "Commands/UploadFeature",
      register(container) {
          container.register(Upload).inSingletonScope();
      }
  });
  ```

### Step 5: Create `src/features/Upload/index.ts`

- [ ] Write:
  ```ts
  export { Upload } from "./abstractions/index.ts";
  export { UploadFeature } from "./feature.ts";
  ```

### Step 6: Rename `src/prompts/confirmSend.ts` → `src/prompts/confirmUpload.ts`

- [ ] Run: `git mv src/prompts/confirmSend.ts src/prompts/confirmUpload.ts`
- [ ] Edit the new file — rename the export only:
  ```ts
  import { input } from "@inquirer/prompts";
  import type { ResolvedTable } from "../config/define.js";

  export const confirmUpload = async (sourcePath: string, table: ResolvedTable): Promise<void> => {
      console.log("");
      console.log(
          `About to write ${sourcePath} → ${table.name} (${table.region}, profile: ${table.awsProfile})`
      );
      await input({
          message: `Type the destination table name to confirm (${table.name}), or Ctrl+C to cancel:`,
          validate: value =>
              value.trim() === table.name ||
              `Input does not match "${table.name}". Try again or press Ctrl+C to cancel.`
      });
  };
  ```
  (`ResolvedTable` continues to come from the `src/config/define.ts` shim; Task 6 updates this to `~/features/Config/index.ts` when the shim goes away.)

### Step 7: Update the action prompt label

- [ ] Edit `src/prompts/action.ts`:
  ```ts
  import { select } from "@inquirer/prompts";

  export type Action = "download" | "upload" | "exit";

  export const promptAction = (): Promise<Action> =>
      select<Action>({
          message: "What would you like to do?",
          choices: [
              { name: "Download a table", value: "download" },
              { name: "Upload a file to a table", value: "upload" },
              { name: "Exit", value: "exit" }
          ]
      });
  ```

### Step 8: Extend `createTestContainer` with UploadFeature

- [ ] Edit `__tests__/containers/createTestContainer.ts`:
  ```ts
  import { Container } from "@webiny/di";
  import { Config, ConfigFeature } from "~/features/Config/index.ts";
  import { AwsClientFeature } from "~/features/AwsClient/index.ts";
  import { DownloadFeature } from "~/features/Download/index.ts";
  import { UploadFeature } from "~/features/Upload/index.ts";

  export interface TestContainerOptions {
      tables?: Config.ResolvedTable[];
  }

  export function createTestContainer(options: TestContainerOptions = {}): Container {
      const container = new Container();
      ConfigFeature.register(container);
      AwsClientFeature.register(container);
      DownloadFeature.register(container);
      UploadFeature.register(container);
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
  ```

### Step 9: Create `__tests__/features/Upload.test.ts`

- [ ] Write:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { mkdirSync, rmSync, writeFileSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { randomUUID } from "node:crypto";
  import { Upload } from "~/features/Upload/index.ts";
  import type { Config } from "~/features/Config/index.ts";
  import { createTestContainer } from "../containers/createTestContainer.ts";
  import {
      createTestTable,
      dropTestTable,
      scanAllItems
  } from "../helpers/dynaliteTables.ts";

  const makeTable = (name: string): Config.ResolvedTable => ({
      name,
      description: "Test table",
      writable: true,
      awsProfile: "test",
      region: "us-east-1"
  });

  function makeTmpDir(): string {
      const dir = join(tmpdir(), `ddbx-test-${randomUUID()}`);
      mkdirSync(dir, { recursive: true });
      return dir;
  }

  describe("Upload", () => {
      const tablesToClean: string[] = [];
      const dirsToClean: string[] = [];

      afterEach(async () => {
          while (tablesToClean.length > 0) {
              const name = tablesToClean.pop();
              if (name !== undefined) {
                  await dropTestTable(name);
              }
          }
          while (dirsToClean.length > 0) {
              const dir = dirsToClean.pop();
              if (dir !== undefined) {
                  rmSync(dir, { recursive: true, force: true });
              }
          }
      });

      it("uploads items from an NDJSON source", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const sourcePath = join(dir, "data.ndjson");
          const items = [
              { PK: "a", value: 1 },
              { PK: "b", value: 2 }
          ];
          writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

          const container = createTestContainer();
          const upload = container.resolve(Upload);
          await upload.run({ sourcePath, table: makeTable(tableName) });

          const scanned = await scanAllItems(tableName);
          expect(scanned).toHaveLength(2);
          expect(scanned.map(s => s.PK).sort()).toEqual(["a", "b"]);
      });

      it("uploads items from a JSON array source", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const sourcePath = join(dir, "data.json");
          const items = [{ PK: "x", value: "hello" }];
          writeFileSync(sourcePath, JSON.stringify(items, null, 2));

          const container = createTestContainer();
          const upload = container.resolve(Upload);
          await upload.run({ sourcePath, table: makeTable(tableName) });

          const scanned = await scanAllItems(tableName);
          expect(scanned).toHaveLength(1);
          expect(scanned[0]?.value).toBe("hello");
      });

      it("chunks large NDJSON sources into 25-item batches", async () => {
          const tableName = await createTestTable();
          tablesToClean.push(tableName);
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const sourcePath = join(dir, "big.ndjson");
          const items = Array.from({ length: 60 }, (_, i) => ({
              PK: `k${i}`,
              value: i
          }));
          writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

          const container = createTestContainer();
          const upload = container.resolve(Upload);
          await upload.run({ sourcePath, table: makeTable(tableName) });

          const scanned = await scanAllItems(tableName);
          expect(scanned).toHaveLength(60);
      });

      it("wraps errors with 'Upload failed:' prefix", async () => {
          const dir = makeTmpDir();
          dirsToClean.push(dir);
          const sourcePath = join(dir, "missing.ndjson");

          const container = createTestContainer();
          const upload = container.resolve(Upload);
          await expect(
              upload.run({ sourcePath, table: makeTable("does-not-exist") })
          ).rejects.toThrowError(/^Upload failed:/);
      });
  });
  ```

### Step 10: Update `src/index.ts` to route upload through the container

- [ ] Edit `src/index.ts`:
  ```ts
  import { Container } from "@webiny/di";
  import { Config, ConfigFeature } from "~/features/Config/index.ts";
  import { AwsClientFeature } from "~/features/AwsClient/index.ts";
  import { Download, DownloadFeature } from "~/features/Download/index.ts";
  import { Upload, UploadFeature } from "~/features/Upload/index.ts";
  import { dataFilePath, extensionFor } from "./lib/paths.js";
  import { promptAction } from "./prompts/action.js";
  import { confirmUpload } from "./prompts/confirmUpload.js";
  import { promptDownloadFormat } from "./prompts/downloadFormat.js";
  import { resolveDestPath } from "./prompts/overwrite.js";
  import { promptSegments } from "./prompts/segments.js";
  import { promptSourceFile } from "./prompts/sourceFile.js";
  import { promptTable } from "./prompts/table.js";

  const container = new Container();
  ConfigFeature.register(container);
  AwsClientFeature.register(container);
  DownloadFeature.register(container);
  UploadFeature.register(container);
  const config = container.resolve(Config);
  const download = container.resolve(Download);
  const upload = container.resolve(Upload);

  const main = async (): Promise<void> => {
      const tables = await config.load();
      const action = await promptAction();

      if (action === "exit") return;

      if (action === "download") {
          const table = await promptTable(tables, "Which table do you want to download?");
          const segments = await promptSegments();
          const format = await promptDownloadFormat(segments);
          const initialPath = dataFilePath(table.description, format);
          const destPath = await resolveDestPath(initialPath, extensionFor(format));
          if (destPath === null) return;
          await download.run({ table, destPath, format, segments });
          return;
      }

      // action === "upload"
      const writableTables = tables.filter(t => t.writable);
      if (writableTables.length === 0) {
          console.log(
              "No writable tables in config.ts. Set `writable: true` on the table you want to upload to."
          );
          return;
      }
      const sourcePath = await promptSourceFile();
      if (sourcePath === null) {
          console.log("No files in data/ to upload.");
          return;
      }
      const table = await promptTable(writableTables, "Which table should receive the data?");
      await confirmUpload(sourcePath, table);
      await upload.run({ sourcePath, table });
  };

  try {
      await main();
  } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
          process.exit(0);
      }
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
  }
  ```

### Step 11: Delete the old send module

- [ ] Run: `git rm src/commands/send.ts`

### Step 12: Verify

- [ ] Run: `yarn ts-check` → exit 0.
- [ ] Run: `yarn test` → Config (3) + AwsClient (2) + Download (4) + Upload (4) all pass.
- [ ] Run: `yarn format:fix && yarn format:check` → exit 0.
- [ ] Manual boot smoke test (menu should show "Upload a file to a table" as the middle option):
  ```sh
  ( yarn start & PID=$!; sleep 2; kill -INT $PID 2>/dev/null; wait $PID 2>/dev/null ) 2>&1 | head -10
  ```

### Step 13: Commit

- [ ] Run:
  ```bash
  git add src/features/Upload/ src/prompts/action.ts src/prompts/confirmUpload.ts \
          src/index.ts \
          __tests__/containers/createTestContainer.ts \
          __tests__/features/Upload.test.ts
  git commit -m "$(cat <<'EOF'
  feat(di): Upload feature (send -> upload)

  Commands/Upload abstraction replaces the old runSend. Impl depends
  on ClientFactory and keeps the full write-side behavior (NDJSON
  streaming vs JSON array parse, 25-item BatchWrite chunks, retry
  loop with fixed 500 ms backoff). Errors wrap with "Upload failed:"
  prefix in place of "Send failed:".

  Renames src/prompts/confirmSend.ts -> confirmUpload.ts. Action
  menu label changes to "Upload a file to a table". src/index.ts
  now routes both branches through the container-resolved
  Download and Upload services.

  Integration tests against dynalite: NDJSON source, JSON array
  source, chunking of large sources, error-path wrapping.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 6: bootstrap + orchestrator cleanup

**Files:**
- Create: `src/bootstrap.ts`
- Modify: `src/index.ts` (replace inline container setup with bootstrap call)
- Modify: `src/prompts/confirmUpload.ts` (switch `ResolvedTable` import to `~/features/Config/index.ts`)
- Modify: `config.ts` (switch defineConfig import to new path)
- Modify: `config.example.ts` (same)
- Delete: `src/config/load.ts`
- Delete: `src/config/define.ts`
- Delete: empty `src/config/` directory

### Step 1: Create `src/bootstrap.ts`

- [ ] Write:
  ```ts
  import { Container } from "@webiny/di";
  import { ConfigFeature } from "~/features/Config/index.ts";
  import { AwsClientFeature } from "~/features/AwsClient/index.ts";
  import { DownloadFeature } from "~/features/Download/index.ts";
  import { UploadFeature } from "~/features/Upload/index.ts";

  export function bootstrap(): Container {
      const container = new Container();
      ConfigFeature.register(container);
      AwsClientFeature.register(container);
      DownloadFeature.register(container);
      UploadFeature.register(container);
      return container;
  }
  ```

### Step 2: Rewrite `src/index.ts` to use `bootstrap`

- [ ] Edit `src/index.ts`:
  ```ts
  import { bootstrap } from "./bootstrap.ts";
  import { Config } from "~/features/Config/index.ts";
  import { Download } from "~/features/Download/index.ts";
  import { Upload } from "~/features/Upload/index.ts";
  import { dataFilePath, extensionFor } from "~/lib/paths.ts";
  import { promptAction } from "~/prompts/action.ts";
  import { confirmUpload } from "~/prompts/confirmUpload.ts";
  import { promptDownloadFormat } from "~/prompts/downloadFormat.ts";
  import { resolveDestPath } from "~/prompts/overwrite.ts";
  import { promptSegments } from "~/prompts/segments.ts";
  import { promptSourceFile } from "~/prompts/sourceFile.ts";
  import { promptTable } from "~/prompts/table.ts";

  const main = async (): Promise<void> => {
      const container = bootstrap();
      const config = container.resolve(Config);
      const download = container.resolve(Download);
      const upload = container.resolve(Upload);

      const tables = await config.load();
      const action = await promptAction();

      if (action === "exit") return;

      if (action === "download") {
          const table = await promptTable(tables, "Which table do you want to download?");
          const segments = await promptSegments();
          const format = await promptDownloadFormat(segments);
          const initialPath = dataFilePath(table.description, format);
          const destPath = await resolveDestPath(initialPath, extensionFor(format));
          if (destPath === null) return;
          await download.run({ table, destPath, format, segments });
          return;
      }

      // action === "upload"
      const writableTables = tables.filter(t => t.writable);
      if (writableTables.length === 0) {
          console.log(
              "No writable tables in config.ts. Set `writable: true` on the table you want to upload to."
          );
          return;
      }
      const sourcePath = await promptSourceFile();
      if (sourcePath === null) {
          console.log("No files in data/ to upload.");
          return;
      }
      const table = await promptTable(writableTables, "Which table should receive the data?");
      await confirmUpload(sourcePath, table);
      await upload.run({ sourcePath, table });
  };

  try {
      await main();
  } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
          process.exit(0);
      }
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
  }
  ```
  Note the switch to `~/` imports for prompts and lib.

### Step 3: Update `src/prompts/confirmUpload.ts` to use the new ResolvedTable path

- [ ] Edit `src/prompts/confirmUpload.ts`:
  ```ts
  import { input } from "@inquirer/prompts";
  import type { Config } from "~/features/Config/index.ts";

  export const confirmUpload = async (
      sourcePath: string,
      table: Config.ResolvedTable
  ): Promise<void> => {
      console.log("");
      console.log(
          `About to write ${sourcePath} → ${table.name} (${table.region}, profile: ${table.awsProfile})`
      );
      await input({
          message: `Type the destination table name to confirm (${table.name}), or Ctrl+C to cancel:`,
          validate: value =>
              value.trim() === table.name ||
              `Input does not match "${table.name}". Try again or press Ctrl+C to cancel.`
      });
  };
  ```

### Step 4: Check every remaining reference to `src/config/*` in the source tree

- [ ] Run:
  ```sh
  grep -rn "src/config\|from \"./config/\|from \"../config/\|from \"../../config/" src/ __tests__/
  ```
  Expected: only the grep command itself and nothing in the source tree. If any file still imports from the old paths, update it to `~/features/Config/index.ts` before proceeding.

  Specifically verify:
  - `src/prompts/sourceFile.ts` — check: does it import `ResolvedTable` from `../config/define`? If so, switch to `~/features/Config/index.ts`.
  - `src/prompts/table.ts` — same check.
  - Any other prompt file that takes a ResolvedTable parameter.

### Step 5: Update `config.ts` to import defineConfig from the new location

- [ ] Edit `config.ts` (at repo root):
  ```ts
  import { defineConfig } from "./src/features/Config/index.js";

  export default defineConfig({
      defaults: {
          awsProfile: "default",
          region: "eu-central-1"
      },
      tables: [
          // ... existing entries unchanged
      ]
  });
  ```
  Keep the `tables` content exactly as the user currently has it locally.

### Step 6: Update `config.example.ts` to import defineConfig from the new location

- [ ] Edit `config.example.ts`:
  ```ts
  import { defineConfig } from "./src/features/Config/index.js";

  export default defineConfig({
      defaults: {
          awsProfile: "default",
          region: "eu-central-1"
      },
      tables: [
          // `description` is shown in the selection prompt and also drives the
          // exported filename (camelCased). Must be unique, non-empty, and ≤ 40
          // characters. `name` is the real DynamoDB table name. `writable` MUST
          // be set explicitly — tables with `writable: false` never appear in
          // the Upload destination list, so accidental writes to the wrong
          // table are impossible.
          { name: "my-table", description: "Production", writable: false }

          // Per-table awsProfile/region are optional; omit to inherit defaults.
          // Flip `writable: true` only on tables you intentionally want to be
          // restore targets.
          // { name: "staging-table", description: "Staging", writable: true, awsProfile: "stage", region: "us-east-1" },
      ]
  });
  ```
  The comment's "Send" language becomes "Upload" to match the rename.

### Step 7: Delete the legacy `src/config/` module

- [ ] Run:
  ```sh
  git rm src/config/load.ts src/config/define.ts
  # After git removes them the directory is empty; remove it:
  rmdir src/config 2>/dev/null || true
  ```

### Step 8: Check for remaining legacy directories

- [ ] Run:
  ```sh
  find src -type d -empty
  ```
  Expected: no output. If `src/aws/`, `src/commands/`, or `src/config/` show up empty, delete them.

### Step 9: Verify

- [ ] Run: `yarn ts-check` → exit 0.
- [ ] Run: `yarn test` → Config (3) + AwsClient (2) + Download (4) + Upload (4) = 13 tests pass.
- [ ] Run: `yarn format:fix && yarn format:check` → exit 0.
- [ ] Manual boot smoke test:
  ```sh
  ( yarn start & PID=$!; sleep 2; kill -INT $PID 2>/dev/null; wait $PID 2>/dev/null ) 2>&1 | head -10
  ```
  Expected: menu renders with Download / Upload / Exit. No module resolution errors.
- [ ] Quick ConfigError path test — temporarily break `config.ts` by setting `tables: []`:
  ```sh
  yarn start 2>&1 | head -5
  ```
  Expected: `config.ts: tables: tables must be a non-empty array` and non-zero exit. Revert `config.ts`.

### Step 10: Commit

- [ ] Run:
  ```bash
  git add src/bootstrap.ts src/index.ts src/prompts/confirmUpload.ts \
          config.ts config.example.ts
  git commit -m "$(cat <<'EOF'
  feat(di): bootstrap + final orchestrator, drop legacy src/config

  src/bootstrap.ts is the composition root: creates a Container,
  registers the four features, returns it. src/index.ts becomes a
  thin CLI entry that calls bootstrap and resolves Config, Download,
  and Upload from the container.

  config.ts and config.example.ts move their defineConfig import to
  ~/features/Config. src/config/define.ts (the re-export shim) and
  src/config/load.ts (the legacy loader) are deleted — everything
  that used them has been migrated.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 7: Final cleanup pass

No new code. This stage catches stragglers (dead imports, empty dirs, comments referencing the old structure, anything the previous verification steps didn't flag).

### Step 1: Check for leftover legacy directories

- [ ] Run:
  ```sh
  ls src/aws src/commands src/config 2>&1 | head
  ```
  Expected: all three report "No such file or directory". If any directory still exists, investigate what's inside and delete it if it's empty.

### Step 2: Grep for stale references

- [ ] Run:
  ```sh
  grep -rn "src/aws\|src/commands\|src/config\|runDownload\|runSend\|confirmSend\|DefaultConfig\|DefaultDownload\|DefaultUpload\|DefaultClientFactory" src/ __tests__/ docs/ config.ts config.example.ts README.md
  ```
  Expected: only hits inside `docs/` (spec/plan historical references are fine) and possibly inside the brainstorming spec of the earlier refactor. Anything else in `src/` or `__tests__/` is a bug to fix.

### Step 3: Verify `docs/backlog.md` doesn't claim the old structure

- [ ] Skim `docs/backlog.md`. If it references `src/commands/*` or `runDownload`/`runSend`, update to reference the new `~/features/*` paths. Otherwise leave untouched.

### Step 4: Full verification pass

- [ ] Run: `yarn ts-check` → exit 0.
- [ ] Run: `yarn test` → 13 tests pass. Coverage shows meaningful numbers on `src/features/*`.
- [ ] Run: `yarn format:fix && yarn format:check` → exit 0.
- [ ] Run: `yarn start` → menu renders; download path works against your configured table; upload path prompts for the destination.

### Step 5: Commit if there were any cleanup edits

- [ ] If Steps 1–3 produced any diffs, commit:
  ```bash
  git add -A
  git commit -m "chore(di): final cleanup"
  ```
  If the working tree is clean (no edits needed), no commit is required — the refactor is complete.

---

## Self-review

**Spec coverage:**

- **Config abstraction** (spec §Abstractions 1) → Task 2.
- **ClientFactory abstraction** (spec §Abstractions 2) → Task 3.
- **Download abstraction** (spec §Abstractions 3) → Task 4.
- **Upload abstraction + Send rename** (spec §Abstractions 4) → Task 5.
- **File and folder layout** (spec §File and folder layout) → the structure is built up across Tasks 1–5; legacy dirs removed in Task 6. Final state verified in Task 7.
- **Base scaffolding** (spec §Base scaffolding) → Task 1.
- **Bootstrap + orchestrator** (spec §Bootstrap and orchestrator) → Task 6.
- **tsconfig paths** (spec §tsconfig changes) → Task 1.
- **vitest + dynalite setup** (spec §vitest + dynalite setup) → Task 1.
- **Test harness createTestContainer** (spec §Test harness) → initial version in Task 2; extended in Tasks 3, 4, 5.
- **Per-feature test strategy** (spec §Test strategy per feature) → Tasks 2 (Config), 3 (AwsClient smoke), 4 (Download integration), 5 (Upload integration).
- **Error handling preserved** (spec §Error handling) → the `Download failed:` / `Upload failed:` wrappers and `ConfigError` prefix are replicated in the new impls with explicit assertions in each test file's error-path case.
- **Deleted files** (spec §What gets deleted or moved) → `src/commands/download.ts` in Task 4, `src/commands/send.ts` + confirmSend rename in Task 5, `src/config/define.ts` shim + `src/config/load.ts` + legacy dirs in Task 6, final cleanup in Task 7.

**Placeholder scan:** no TBDs, no "similar to Task N", no "add appropriate handling" — every step has complete code and exact commands.

**Type consistency:**

- `Config.Interface` — `{ load(): Promise<Config.ResolvedTable[]> }`. Used identically in ConfigImpl, test fakes, index.ts.
- `Config.ResolvedTable` — `{ name, description, writable, awsProfile, region }` all strings/booleans. Consistent across Download and Upload tests' `makeTable` helper and ConfigImpl's `resolve` mapping.
- `ClientFactory.Interface.create(table: Config.ResolvedTable): ClientFactory.Client` — signature identical in impl, Download impl, Upload impl, and the AwsClient smoke test.
- `Download.RunOptions` — `{ table, destPath, format, segments }`. Same shape everywhere; no drift.
- `Upload.RunOptions` — `{ sourcePath, table }`. Same shape everywhere.
- `confirmUpload(sourcePath, table)` — parameter types match both Task 5's initial version (still importing from the shim) and Task 6's updated version (importing from `~/features/Config`).
- `Action` type — `"download" | "upload" | "exit"`. Updated in Task 5 Step 7; referenced correctly in Task 5 Step 10's `src/index.ts` branch check (`action === "upload"`, not `"send"`).
- Action menu label — `"Upload a file to a table"` in Task 5; no residual "Send" strings in Tasks 6 or 7's orchestrator.
