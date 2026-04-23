# NDJSON Parse Error Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an injectable `ParseNdJsonErrorHandler` DI feature so users can decide per-line what to do on NDJSON parse failures, and extend `defineConfig` to a factory-only async form that receives the DI container.

**Architecture:** `ParseNdJsonErrorHandler` is a new feature following the standard five-file pattern. `Upload` injects it; `getParsed` becomes async and calls `handler.handle()` on failure (null = skip, object = substitute, throw = abort). `defineConfig` becomes a factory `(ctx) => RawConfig | Promise<RawConfig>`; `bootstrap()` becomes async, calls the factory, validates, and registers a static `Config` instance. `src/index.ts` is the public barrel users import from.

**Tech Stack:** TypeScript (nodenext strict), `@webiny/di`, `@inquirer/prompts`, vitest + dynalite.

---

## File map

| File | Action |
|------|--------|
| `src/features/ParseNdJsonErrorHandler/abstractions/ParseNdJsonErrorHandler.ts` | **create** — abstraction token + types |
| `src/features/ParseNdJsonErrorHandler/abstractions/index.ts` | **create** — re-exports |
| `src/features/ParseNdJsonErrorHandler/ParseNdJsonErrorHandler.ts` | **create** — default impl (throws) |
| `src/features/ParseNdJsonErrorHandler/feature.ts` | **create** — registers default impl |
| `src/features/ParseNdJsonErrorHandler/index.ts` | **create** — public surface |
| `__tests__/containers/createTestContainer.ts` | **modify** — register `ParseNdJsonErrorHandlerFeature` |
| `__tests__/features/Upload.test.ts` | **modify** — add 2 failing tests, then passing after Task 3 |
| `src/features/Upload/Upload.ts` | **modify** — inject handler, async `getParsed`, pass `table` through `sendNdjson` |
| `src/features/Config/abstractions/Config.ts` | **modify** — `defineConfig` factory-only + `ConfigFactory` type |
| `src/features/Config/index.ts` | **modify** — re-export `ConfigFactory` + `ConfigSchema` |
| `src/bootstrap.ts` | **modify** — async, factory invocation, `registerInstance(Config, ...)`, register `ParseNdJsonErrorHandlerFeature` |
| `src/cli.ts` | **modify** — `await bootstrap()`, wrap in top-level try/catch |
| `src/index.ts` | **modify** — export `defineConfig` + `ParseNdJsonErrorHandler` |
| `config.example.ts` | **modify** — factory form |

---

### Task 1: Create `ParseNdJsonErrorHandler` feature + register in test container

**Files:**
- Create: `src/features/ParseNdJsonErrorHandler/abstractions/ParseNdJsonErrorHandler.ts`
- Create: `src/features/ParseNdJsonErrorHandler/abstractions/index.ts`
- Create: `src/features/ParseNdJsonErrorHandler/ParseNdJsonErrorHandler.ts`
- Create: `src/features/ParseNdJsonErrorHandler/feature.ts`
- Create: `src/features/ParseNdJsonErrorHandler/index.ts`
- Modify: `__tests__/containers/createTestContainer.ts`

- [ ] **Step 1: Create the abstraction**

`src/features/ParseNdJsonErrorHandler/abstractions/ParseNdJsonErrorHandler.ts`:

```typescript
import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface IParseNdJsonErrorHandler {
    handle(options: IHandleOptions): Promise<Record<string, unknown> | null>;
}

export interface IHandleOptions {
    table: Config.ResolvedTable;
    line: string;
    error: unknown;
}

export const ParseNdJsonErrorHandler = createAbstraction<IParseNdJsonErrorHandler>(
    "Upload/ParseNdJsonErrorHandler"
);

export namespace ParseNdJsonErrorHandler {
    export type Interface = IParseNdJsonErrorHandler;
    export type HandleOptions = IHandleOptions;
}
```

- [ ] **Step 2: Create abstractions index**

`src/features/ParseNdJsonErrorHandler/abstractions/index.ts`:

```typescript
export { ParseNdJsonErrorHandler } from "./ParseNdJsonErrorHandler.ts";
```

- [ ] **Step 3: Create the default implementation (throws)**

`src/features/ParseNdJsonErrorHandler/ParseNdJsonErrorHandler.ts`:

```typescript
import { ParseNdJsonErrorHandler as ParseNdJsonErrorHandlerAbstraction } from "./abstractions/index.ts";

class ParseNdJsonErrorHandlerImpl implements ParseNdJsonErrorHandlerAbstraction.Interface {
    public async handle(
        options: ParseNdJsonErrorHandlerAbstraction.HandleOptions
    ): Promise<Record<string, unknown> | null> {
        throw options.error;
    }
}

export const ParseNdJsonErrorHandler = ParseNdJsonErrorHandlerAbstraction.createImplementation({
    implementation: ParseNdJsonErrorHandlerImpl,
    dependencies: []
});
```

- [ ] **Step 4: Create the feature**

`src/features/ParseNdJsonErrorHandler/feature.ts`:

```typescript
import { createFeature } from "~/base/index.ts";
import { ParseNdJsonErrorHandler } from "./ParseNdJsonErrorHandler.ts";

export const ParseNdJsonErrorHandlerFeature = createFeature({
    name: "Upload/ParseNdJsonErrorHandlerFeature",
    register(container) {
        container.register(ParseNdJsonErrorHandler).inSingletonScope();
    }
});
```

- [ ] **Step 5: Create the public index**

`src/features/ParseNdJsonErrorHandler/index.ts`:

```typescript
export { ParseNdJsonErrorHandler } from "./abstractions/index.ts";
export { ParseNdJsonErrorHandlerFeature } from "./feature.ts";
```

- [ ] **Step 6: Register in test container**

Full replacement of `__tests__/containers/createTestContainer.ts`:

```typescript
import { Container } from "@webiny/di";
import { Config, ConfigFeature } from "~/features/Config/index.ts";
import { LoggerFeature } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";
import { ParseNdJsonErrorHandlerFeature } from "~/features/ParseNdJsonErrorHandler/index.ts";

export interface TestContainerOptions {
  tables?: Config.ResolvedTable[];
}

export function createTestContainer(options: TestContainerOptions = {}): Container {
  const container = new Container();
  LoggerFeature.register(container, { logLevel: "silent", json: false });
  PathsFeature.register(container);
  PrompterFeature.register(container);
  ConfigFeature.register(container);
  AwsClientFeature.register(container);
  DownloadFeature.register(container);
  UploadFeature.register(container);
  ParseNdJsonErrorHandlerFeature.register(container);
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
```

- [ ] **Step 7: Run `yarn ts-check` and all tests to verify nothing broke**

```bash
yarn ts-check 2>&1 | grep "error TS" && yarn test 2>&1 | grep -E "Tests |FAIL"
```

Expected: 0 TypeScript errors, all existing tests pass (50 passed).

- [ ] **Step 8: Commit**

```bash
git add src/features/ParseNdJsonErrorHandler __tests__/containers/createTestContainer.ts
git commit -m "feat(parse-error-handler): add ParseNdJsonErrorHandler feature"
```

---

### Task 2: Write failing Upload tests for parse-error handling

**Files:**
- Modify: `__tests__/features/Upload.test.ts`

- [ ] **Step 1: Add import for ParseNdJsonErrorHandler**

Add to the imports at the top of `__tests__/features/Upload.test.ts`:

```typescript
import { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
```

- [ ] **Step 2: Add two failing tests**

Append inside the `describe("Upload", ...)` block in `__tests__/features/Upload.test.ts`:

```typescript
  it("skips an unparseable NDJSON line when handler returns null", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    writeFileSync(
      sourcePath,
      [
        JSON.stringify({ PK: "a", value: 1 }),
        "not-valid-json",
        JSON.stringify({ PK: "b", value: 2 })
      ].join("\n") + "\n"
    );

    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, {
      handle: async () => null
    });
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["a", "b"]);
  });

  it("substitutes an unparseable NDJSON line when handler returns an object", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    writeFileSync(
      sourcePath,
      [JSON.stringify({ PK: "a", value: 1 }), "not-valid-json"].join("\n") + "\n"
    );

    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, {
      handle: async () => ({ PK: "fallback", value: 0 })
    });
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["a", "fallback"]);
  });
```

- [ ] **Step 3: Run tests to verify the 2 new tests fail**

```bash
yarn test --reporter=verbose 2>&1 | grep -E "✓|×|FAIL|Tests "
```

Expected: 2 new tests fail with `Upload failed:` (Upload currently throws on bad JSON regardless of handler).

- [ ] **Step 4: Commit**

```bash
git add __tests__/features/Upload.test.ts
git commit -m "test(upload): add failing parse-error-handler tests"
```

---

### Task 3: Integrate `ParseNdJsonErrorHandler` into Upload

**Files:**
- Modify: `src/features/Upload/Upload.ts`

- [ ] **Step 1: Replace Upload.ts**

Full replacement of `src/features/Upload/Upload.ts`:

```typescript
import type { BatchWriteCommandInput, BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { ClientFactory } from "~/features/AwsClient/index.ts";
import { Logger } from "~/features/Logger/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { Upload as UploadAbstraction } from "./abstractions/index.ts";

const CHUNK_SIZE = 25;
const BACKOFF_MS = 500;

class UploadImpl implements UploadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly paths: Paths.Interface,
        private readonly clientFactory: ClientFactory.Interface,
        private readonly handler: ParseNdJsonErrorHandler.Interface
    ) {}

    public async run(options: UploadAbstraction.RunOptions): Promise<void> {
        const { sourcePath, table, startFrom } = options;
        const client = this.clientFactory.create(table);
        const format = this.paths.detectFormat(sourcePath);
        try {
            if (format === "ndjson") {
                await this.sendNdjson(client, table, sourcePath, startFrom);
            } else if (format === "json") {
                await this.sendJson(client, table.name, sourcePath, startFrom);
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
        sourcePath: string,
        startFrom: number
    ): Promise<void> {
        const items = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>[];
        let written = startFrom;
        for (let i = startFrom; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            await this.sendChunk(client, tableName, chunk);
            written += chunk.length;
            this.logger.info(`Written ${written}/${items.length}`);
        }
        this.logger.done(`Wrote ${written - startFrom} items to ${tableName}`);
    }

    private async sendNdjson(
        client: ClientFactory.Client,
        table: Config.ResolvedTable,
        sourcePath: string,
        startFrom: number
    ): Promise<void> {
        const rl = createInterface({
            input: createReadStream(sourcePath),
            crlfDelay: Infinity
        });

        let buffer: Record<string, unknown>[] = [];
        let written = 0;
        let lineIndex = 0;
        for await (const line of rl) {
            if (line.trim().length === 0) {
                continue;
            }
            if (lineIndex++ < startFrom) {
                continue;
            }
            const parsed = await this.getParsed(line, table);
            if (parsed === null) {
                continue;
            }
            buffer.push(parsed);
            if (buffer.length >= CHUNK_SIZE) {
                await this.sendChunk(client, table.name, buffer);
                written += buffer.length;
                this.logger.info(`Written ${startFrom + written} items...`);
                buffer = [];
            }
        }
        if (buffer.length > 0) {
            await this.sendChunk(client, table.name, buffer);
            written += buffer.length;
        }
        this.logger.done(`Wrote ${written} items to ${table.name}`);
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
                result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0
                    ? result.UnprocessedItems
                    : undefined;
            if (unprocessed) {
                await new Promise(r => setTimeout(r, BACKOFF_MS));
            }
        }
    }

    private async getParsed(
        line: string,
        table: Config.ResolvedTable
    ): Promise<Record<string, unknown> | null> {
        try {
            return JSON.parse(line) as Record<string, unknown>;
        } catch (error) {
            this.logger.debug(`Failed to parse line as JSON: ${line}`);
            return this.handler.handle({ table, line, error });
        }
    }
}

export const Upload = UploadAbstraction.createImplementation({
    implementation: UploadImpl,
    dependencies: [Logger, Paths, ClientFactory, ParseNdJsonErrorHandler]
});
```

- [ ] **Step 2: Run all tests**

```bash
yarn test --reporter=verbose 2>&1 | grep -E "Tests |FAIL"
```

Expected: all 52 tests pass (50 existing + 2 new).

- [ ] **Step 3: Run ts-check**

```bash
yarn ts-check 2>&1 | grep "error TS"
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/Upload/Upload.ts
git commit -m "feat(upload): inject ParseNdJsonErrorHandler, async getParsed with skip/substitute support"
```

---

### Task 4: `defineConfig` factory + async bootstrap + public barrel

**Files:**
- Modify: `src/features/Config/abstractions/Config.ts`
- Modify: `src/features/Config/index.ts`
- Modify: `src/bootstrap.ts`
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `config.example.ts`

- [ ] **Step 1: Update `defineConfig` to factory-only form and export `ConfigFactory`**

Full replacement of `src/features/Config/abstractions/Config.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createAbstraction } from "~/base/index.ts";
import { ConfigSchema, type RawConfig } from "./schema.ts";

export type ConfigFactory = (ctx: { container: Container }) => RawConfig | Promise<RawConfig>;

export interface IConfig {
    load(): Promise<IResolvedTable[]>;
}

export interface IResolvedTable {
    name: string;
    description: string;
    writable: boolean;
    awsProfile: string;
    region: string;
}

export const Config = createAbstraction<IConfig>("Config/Config");

export namespace Config {
    export type Interface = IConfig;
    export type ResolvedTable = IResolvedTable;
}

export class ConfigError extends Error {
    public constructor(message: string) {
        super(`config.ts: ${message}`);
        this.name = "ConfigError";
    }
}

export function defineConfig(factory: ConfigFactory): ConfigFactory {
    return factory;
}

export { ConfigSchema };
```

- [ ] **Step 2: Re-export `ConfigFactory` and `ConfigSchema` from the Config feature index**

Full replacement of `src/features/Config/index.ts`:

```typescript
export { Config, ConfigError, ConfigFactory, defineConfig } from "./abstractions/index.ts";
export { ConfigFeature } from "./feature.ts";
export { ConfigSchema } from "./abstractions/schema.ts";
```

Also update `src/features/Config/abstractions/index.ts` to re-export `ConfigFactory`:

```typescript
export { Config, ConfigError, ConfigFactory, defineConfig, ConfigSchema } from "./Config.ts";
```

- [ ] **Step 3: Run `yarn ts-check` to confirm Config changes compile**

```bash
yarn ts-check 2>&1 | grep "error TS"
```

Expected: errors only in `src/bootstrap.ts` (still calling the old sync pattern) and `config.example.ts` (old plain-object form). Zero errors elsewhere.

- [ ] **Step 4: Rewrite `src/bootstrap.ts` as async**

Full replacement of `src/bootstrap.ts`:

```typescript
import { Container } from "@webiny/di";
import { LoggerFeature, readLoggerParamsFromEnv } from "~/features/Logger/index.ts";
import { PathsFeature } from "~/features/Paths/index.ts";
import { PrompterFeature } from "~/features/Prompter/index.ts";
import { Config, ConfigError, ConfigFactory, ConfigSchema } from "~/features/Config/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";
import { DownloadFeature } from "~/features/Download/index.ts";
import { UploadFeature } from "~/features/Upload/index.ts";
import { ParseNdJsonErrorHandlerFeature } from "~/features/ParseNdJsonErrorHandler/index.ts";
import { CliFeature } from "~/features/Cli/index.ts";

export async function bootstrap(): Promise<Container> {
    const container = new Container();
    LoggerFeature.register(container, readLoggerParamsFromEnv(process.env));
    PathsFeature.register(container);
    PrompterFeature.register(container);
    AwsClientFeature.register(container);
    DownloadFeature.register(container);
    UploadFeature.register(container);
    ParseNdJsonErrorHandlerFeature.register(container);
    CliFeature.register(container);

    const resolvedTables = await loadConfig(container);
    container.registerInstance(Config, { load: async () => resolvedTables });

    return container;
}

async function loadConfig(container: Container): Promise<Config.ResolvedTable[]> {
    let factory: ConfigFactory;
    try {
        const mod = await import("../../config.js");
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
        const msg = first ? (path.length > 0 ? `${path}: ${first.message}` : first.message) : "invalid config";
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
```

- [ ] **Step 5: Update `src/cli.ts` to await bootstrap**

Full replacement of `src/cli.ts`:

```typescript
import { bootstrap } from "./bootstrap.ts";
import { Cli } from "~/features/Cli/index.ts";
import { Logger } from "~/features/Logger/index.ts";

try {
    const container = await bootstrap();
    const cli = container.resolve(Cli);
    const logger = container.resolve(Logger);
    try {
        await cli.run();
    } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
            process.exit(0);
        }
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
} catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}
```

- [ ] **Step 6: Update `src/index.ts` public barrel**

Full replacement of `src/index.ts`:

```typescript
export { defineConfig } from "./features/Config/index.ts";
export { ParseNdJsonErrorHandler } from "./features/ParseNdJsonErrorHandler/index.ts";
```

- [ ] **Step 7: Update `config.example.ts` to factory form**

Full replacement of `config.example.ts`:

```typescript
import { defineConfig } from "./src/index.js";

export default defineConfig(async ({ container }) => {
  // Register custom services here. Example:
  // import { ParseNdJsonErrorHandler } from "./src/index.js";
  // container.registerInstance(ParseNdJsonErrorHandler, new MyHandler());

  return {
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
      { name: "my-table", description: "Production", writable: false as const }

      // Per-table awsProfile/region are optional; omit to inherit defaults.
      // Flip `writable: true` only on tables you intentionally want to be
      // restore targets.
      // { name: "staging-table", description: "Staging", writable: true, awsProfile: "stage", region: "us-east-1" },
    ]
  };
});
```

- [ ] **Step 8: Run `yarn ts-check` — zero errors expected**

```bash
yarn ts-check 2>&1 | grep -c "error TS" || echo "0"
```

Expected: `0`

- [ ] **Step 9: Run all tests**

```bash
yarn test 2>&1 | grep -E "Tests |FAIL"
```

Expected: all 52 tests pass. (Tests use `createTestContainer` which bypasses the factory + bootstrap path entirely — no test changes needed.)

- [ ] **Step 10: Run format check; fix if needed**

```bash
yarn format:check 2>&1 || yarn format:fix
```

- [ ] **Step 11: Commit**

```bash
git add src/features/Config/abstractions/Config.ts \
        src/features/Config/abstractions/index.ts \
        src/features/Config/index.ts \
        src/bootstrap.ts \
        src/cli.ts \
        src/index.ts \
        config.example.ts
git commit -m "feat(config): defineConfig factory form + async bootstrap + public barrel"
```
