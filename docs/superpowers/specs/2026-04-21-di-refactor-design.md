# dynamodb-extract DI refactor — design

**Date:** 2026-04-21
**Status:** Approved, pending implementation plan
**Depends on:** `@webiny/di@^0.2.3` (already installed), `docs/webiny-di-guide.md` (conventions; updated in commit `ca72f94`).
**Prior spec:** `docs/superpowers/specs/2026-04-21-dynamodb-extract-refactor-design.md` (single-table → multi-table CLI). Historical; this spec is a follow-up.

## Goal

Restructure the four core services of this CLI — config loading, AWS client construction, download command, upload command — behind `@webiny/di` abstractions. Pure helpers (`src/lib/paths.ts`) and prompt wrappers (`src/prompts/*.ts`) stay as plain functions. Send is renamed to Upload in the process.

Tests for each new feature land as part of this change, using `vitest` + `dynalite` (local DynamoDB emulator) + a shared `createTestContainer` harness.

## Non-goals (explicit)

- Prompts becoming abstractions. Deferred — they will migrate to DI later. Structure the code so that future wrap is small.
- `src/lib/paths.ts` becoming an abstraction.
- Any functional change to what the CLI does. Behavior stays identical.
- Parallel scan internals, backoff strategy, or streaming format changes.

## Library conventions in play

See `docs/webiny-di-guide.md`. The critical naming rule (documented in the guide's §6 post this update):

- The abstraction token and the `createImplementation` export **share the same short name** (e.g. `Config`, `Download`, `Upload`, `ClientFactory`).
- The impl file uses a **local rename alias** to avoid the name clash: `import { Config as ConfigAbstraction } from "./abstractions/index.ts"`.
- The local alias never leaves the impl file. Consumers writing `dependencies: [Config]` or `private readonly config: Config.Interface` see only the clean short name.
- Area prefix on every abstraction and feature name, at least two levels: `"Config/Config"`, `"Aws/ClientFactory"`, `"Commands/Download"`, `"Commands/Upload"`; `"Config/ConfigFeature"`, `"Aws/AwsClientFeature"`, `"Commands/DownloadFeature"`, `"Commands/UploadFeature"`.

## Abstractions

Four container-managed abstractions, all registered in **singleton** scope (stateless services — resolve once, reuse).

### 1. `Config` (area: `Config`)

```ts
// abstractions/Config.ts
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
```

- Impl (`ConfigImpl`) dynamic-imports the user's `config.ts`, parses via the existing zod schema in `src/config/define.ts`, maps to `Config.ResolvedTable[]`. (The existing `src/config/define.ts` schema file stays — it's not DI-managed, it's the schema definition. `ConfigImpl` imports it.)
- Error path for missing `config.ts` or invalid config: throw `ConfigError` with the existing `config.ts: …` prefix. Same UX as today.
- No dependencies.

### 2. `ClientFactory` (area: `Aws`)

```ts
// abstractions/ClientFactory.ts
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

- Impl wraps today's `createClient` — `DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials: fromNodeProviderChain({ profile }) }))`.
- `ClientFactory.Client` is a type alias to `DynamoDBDocumentClient`. It's re-exported so Download/Upload don't need to import from the SDK directly — they use `ClientFactory.Client`.
- No dependencies.
- **Endpoint override for tests:** none at the DI layer. The SDK reads `AWS_ENDPOINT_URL_DYNAMODB` from the environment. The vitest globalSetup sets this before tests run, which routes the real impl at dynalite without any code change.

### 3. `Download` (area: `Commands`)

```ts
// abstractions/Download.ts
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

- Impl depends on `ClientFactory` only.
- Body: today's `runDownload` logic (parallel-scan NDJSON or sequential JSON), using `clientFactory.create(options.table)` to get the SDK client and `client.send(new ScanCommand(...))` as today.
- Errors rethrown with `"Download failed: …"` prefix, identical to current.

### 4. `Upload` (area: `Commands`, renamed from Send)

```ts
// abstractions/Upload.ts
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

- Depends on `ClientFactory`.
- Body: today's `runSend` logic (NDJSON streaming or JSON array, chunking, retry loop with fixed 500 ms backoff). Method name stays `run`.
- Errors rethrown with `"Upload failed: …"` prefix (changed from `"Send failed:"` as part of the rename).
- Action menu label changes to `"Upload a file to a table"`. Confirm prompt wording stays identical; the file `src/prompts/confirmSend.ts` is renamed to `src/prompts/confirmUpload.ts`.

## File and folder layout

```
src/
  base/
    createAbstraction.ts      # new
    createFeature.ts          # new
    index.ts                  # re-exports createAbstraction, createFeature

  features/
    Config/
      abstractions/
        Config.ts             # token + Interface + ResolvedTable types
        index.ts
      Config.ts               # ConfigImpl + createImplementation export
      feature.ts              # ConfigFeature
      index.ts                # exports Config abstraction + ConfigFeature
    AwsClient/
      abstractions/
        ClientFactory.ts      # token + Interface + Client type alias
        index.ts
      ClientFactory.ts        # ClientFactoryImpl + createImplementation export
      feature.ts              # AwsClientFeature
      index.ts
    Download/
      abstractions/
        Download.ts           # token + Interface + RunOptions
        index.ts
      Download.ts             # DownloadImpl (current runDownload body)
      feature.ts
      index.ts
    Upload/
      abstractions/
        Upload.ts             # token + Interface + RunOptions
        index.ts
      Upload.ts               # UploadImpl (current runSend body)
      feature.ts
      index.ts

  prompts/                    # unchanged behaviorally
    action.ts
    confirmUpload.ts          # renamed from confirmSend.ts
    downloadFormat.ts
    overwrite.ts
    segments.ts
    sourceFile.ts
    table.ts

  lib/
    paths.ts                  # unchanged

  bootstrap.ts                # new — composition root
  index.ts                    # REWRITTEN — CLI orchestrator resolving services

__tests__/
  setup.ts                    # vitest globalSetup / teardown — starts dynalite
  containers/
    createTestContainer.ts    # shared harness
  helpers/
    dynaliteTables.ts         # createTestTable / dropTestTable / putTestItems
  features/
    Config.test.ts
    AwsClient.test.ts         # smoke test against dynalite
    Download.test.ts          # integration tests via dynalite
    Upload.test.ts            # integration tests via dynalite

config.ts                     # unchanged, gitignored
config.example.ts             # unchanged

vitest.config.ts              # new
```

### What gets deleted or moved

- `src/aws/client.ts` — replaced by `src/features/AwsClient/ClientFactory.ts`. `src/aws/` directory goes away with it.
- `src/commands/download.ts` — replaced by `src/features/Download/Download.ts`.
- `src/commands/send.ts` — replaced by `src/features/Upload/Upload.ts`. `src/commands/` directory goes away after both.
- `src/config/load.ts` — replaced by `src/features/Config/Config.ts`.
- `src/config/define.ts` — **split and relocated**. The zod schema + derived types go to `src/features/Config/abstractions/schema.ts` (imported by `ConfigImpl` at runtime and by `abstractions/Config.ts` for the `ResolvedTable` type). The `defineConfig` passthrough helper goes to `src/features/Config/abstractions/Config.ts` and is re-exported from `src/features/Config/index.ts` as part of that feature's public surface. `src/config/` directory goes away.
- Root `config.ts` and `config.example.ts` update their import: `import { defineConfig } from "./src/features/Config/index.js"` (or the tsx-friendly path at time of implementation).

## Base scaffolding

`src/base/createAbstraction.ts`:
```ts
import { Abstraction } from "@webiny/di";

export function createAbstraction<T>(name: string): Abstraction<T> {
    return new Abstraction<T>(name);
}
```

`src/base/createFeature.ts`:
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

Simpler than the guide's generic `createFeature<TContext>` because none of our four features need a context arg. Adding context support later is a two-line change.

`src/base/index.ts` — barrel re-export of both.

No `ContainerToken`. None of our four abstractions need the container at runtime.

## Bootstrap and orchestrator

`src/bootstrap.ts`:
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

No args. No options. Composition for four features is direct.

`src/index.ts`:
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
        console.log("No writable tables in config.ts. Set `writable: true` on the table you want to upload to.");
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

Action type changes to `"download" | "upload" | "exit"`. `promptAction` label for the send branch changes to `"Upload a file to a table"`.

## tsconfig changes

Add:
```jsonc
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "~/*": ["src/*"]
        }
    }
}
```

No other changes. Keeps `nodenext` + `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.

## vitest + dynalite setup

**Install (devDeps):** `vitest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`, `dynalite`.

**`vitest.config.ts`:**
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

**`__tests__/setup.ts`:**
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
    await new Promise<void>(resolve => server.close(() => resolve()));
}
```

**Scripts (`package.json`):**
- `"test": "vitest run --coverage"` — one-shot, coverage on.
- `"test:watch": "vitest"` — interactive, coverage off (speed).

**`oxfmt` patterns:** update `format:fix` to include `__tests__/**/*.ts`.

## Test harness

**`__tests__/containers/createTestContainer.ts`:**
```ts
import { Container } from "@webiny/di";
import { ConfigFeature, Config } from "~/features/Config/index.ts";
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

The `registerInstance(Config, ...)` after `ConfigFeature.register(...)` takes precedence in the resolver (verified in the library source: `tryResolveFromCurrentContainer` checks `instanceRegistrations` before `registrations`).

**`__tests__/helpers/dynaliteTables.ts`:** signatures in the earlier design section. Internally uses `@aws-sdk/client-dynamodb` directly (raw `CreateTableCommand`, `DeleteTableCommand`) — no need to go through `ClientFactory`.

## Test strategy per feature

- **`Config.test.ts`** — pure unit. Register a Config override via `registerInstance` on a fresh container OR bypass DI entirely and exercise the zod schema + resolver in the impl. Multiple cases: valid config, missing description, too-long description, duplicate names, duplicate descriptions, missing writable, etc.
- **`AwsClient.test.ts`** — smoke test. Resolve ClientFactory, create a client for a fake `ResolvedTable`, run a trivial `ScanCommand` against dynalite, assert a well-formed response. Proves the factory wires the endpoint/credentials chain correctly.
- **`Download.test.ts`** — integration. Per test: create a seeded dynalite table, resolve Download, run it against a `tmp` destination, read the output file back, assert item count and content. Separate tests for NDJSON/1-segment, NDJSON/parallel, JSON array, and missing-table error.
- **`Upload.test.ts`** — integration. Per test: create an empty dynalite table, resolve Upload, run it against a fixture file, scan the table back, assert items match. Separate tests for NDJSON source, JSON source.

Dynamic table naming per test: `test-${Date.now()}-${n}` or `crypto.randomUUID()` — cleanup in `afterEach`.

## Migration strategy (incremental)

Seven committed stages. Each stage lands typecheck-green, test-green (where applicable), format-clean.

1. **Base infra + test infrastructure.**
    - `src/base/{createAbstraction,createFeature,index}.ts`.
    - Install `vitest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`, `dynalite`.
    - `vitest.config.ts`, `__tests__/setup.ts`, `__tests__/helpers/dynaliteTables.ts`.
    - `tsconfig.json` adds `baseUrl` + `paths`.
    - `package.json` scripts: add `test`, `test:watch`; update `format:fix` to include `__tests__/**/*.ts`.
    - Commit: `chore(di): base infra, vitest + dynalite, path alias`
2. **Config feature.** New `src/features/Config/*` + move zod schema to `abstractions/schema.ts`. Update root `config.ts` and `config.example.ts` imports. Old `src/config/load.ts` stays briefly. `__tests__/features/Config.test.ts`. Commit: `feat(di): Config feature`.
3. **AwsClient feature.** New `src/features/AwsClient/*`. Old `src/aws/client.ts` untouched. `__tests__/features/AwsClient.test.ts`. Commit: `feat(di): AwsClient feature`.
4. **Download feature.** New `src/features/Download/*`. Delete old `src/commands/download.ts`. Update `src/index.ts` temporarily to call into the new Download via container. `__tests__/features/Download.test.ts`. Commit: `feat(di): Download feature`.
5. **Upload feature (rename from Send).** New `src/features/Upload/*`. Delete `src/commands/send.ts`. Rename `src/prompts/confirmSend.ts` → `confirmUpload.ts`. Update action menu label. Update `src/index.ts` to call Upload. `__tests__/features/Upload.test.ts`. Commit: `feat(di): Upload feature (send → upload)`.
6. **Bootstrap + final orchestrator.** `src/bootstrap.ts`. Rewrite `src/index.ts` to its final form. Delete old `src/config/load.ts` and the `src/commands/` / `src/aws/` empty dirs. Commit: `feat(di): bootstrap + orchestrator`.
7. **Final verification pass.** No code changes expected. Run `yarn ts-check && yarn format:check && yarn test` — all green. If anything leaks, this is where it shows up. If nothing changes, skip the commit; if there's a tiny follow-up (lint fix, a stray import), commit as `chore(di): cleanup`.

Between stages, typecheck and tests stay green. The old `src/commands/download.ts` stays functional until stage 4 is complete (at which point `src/index.ts` routes through the new Download impl). Same for each component.

## Error handling

Same as today. `Download failed: <msg>`, `Upload failed: <msg>` (renamed from `Send failed:`). `ConfigError` still thrown with `config.ts: …` prefix. `ExitPromptError` on Ctrl+C still maps to exit 0. No new error class.

## Out of scope

- Prompts as abstractions (deferred — see Non-goals).
- `src/lib/paths.ts` as an abstraction.
- Any behavioral change (parallelism defaults, cap, backoff, format choices, etc.).
- Test coverage threshold enforcement (coverage is collected and reported but no failing threshold set).
- End-to-end / smoke tests running the CLI against real AWS.

## Open questions at time of writing

None. All design decisions have been resolved during brainstorming.
