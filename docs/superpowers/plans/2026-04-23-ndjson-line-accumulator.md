# NdJsonLineAccumulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `NdJsonLineAccumulator` feature that accumulates NDJSON lines that fail to parse and retries combinations, so multi-line records in NDJSON files are handled correctly.

**Architecture:** A new DI feature `NdJsonLineAccumulator` sits between the readline loop in `Upload.ts` and JSON parsing. Every line passes through `feed()`, which tries multiple join strategies before deciding to accumulate or discard. `Upload.ts` drops its direct `ParseNdJsonErrorHandler` dependency — the accumulator owns that relationship instead.

**Tech Stack:** TypeScript, vitest, `@webiny/di`, Node.js readline

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/features/NdJsonLineAccumulator/abstractions/NdJsonLineAccumulator.ts` | Interface + token |
| Create | `src/features/NdJsonLineAccumulator/abstractions/index.ts` | Re-export |
| Create | `src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.ts` | Default implementation |
| Create | `src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts` | Tests |
| Create | `src/features/NdJsonLineAccumulator/feature.ts` | DI registration |
| Create | `src/features/NdJsonLineAccumulator/index.ts` | Barrel export |
| Modify | `src/features/Upload/Upload.ts` | Swap dependency, remove `getParsed()`, call `flush()` |
| Modify | `src/bootstrap.ts` | Register `NdJsonLineAccumulatorFeature` |
| Modify | `src/index.ts` | Export `NdJsonLineAccumulator` |

---

## Task 1: Abstraction

**Files:**
- Create: `src/features/NdJsonLineAccumulator/abstractions/NdJsonLineAccumulator.ts`
- Create: `src/features/NdJsonLineAccumulator/abstractions/index.ts`

- [ ] **Step 1: Create the abstraction file**

`src/features/NdJsonLineAccumulator/abstractions/NdJsonLineAccumulator.ts`:

```typescript
import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface INdJsonLineAccumulator {
    feed(line: string, table: Config.ResolvedTable): Promise<Record<string, unknown> | null>;
    flush(table: Config.ResolvedTable): Promise<void>;
}

export const NdJsonLineAccumulator = createAbstraction<INdJsonLineAccumulator>(
    "Upload/NdJsonLineAccumulator"
);

export namespace NdJsonLineAccumulator {
    export type Interface = INdJsonLineAccumulator;
}
```

- [ ] **Step 2: Create the abstractions barrel**

`src/features/NdJsonLineAccumulator/abstractions/index.ts`:

```typescript
export { NdJsonLineAccumulator } from "./NdJsonLineAccumulator.ts";
```

- [ ] **Step 3: Commit**

```bash
git add src/features/NdJsonLineAccumulator/abstractions/
git commit -m "feat(NdJsonLineAccumulator): add abstraction"
```

---

## Task 2: Tests and Implementation

**Files:**
- Create: `src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts`
- Create: `src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Logger } from "~/features/Logger/index.ts";
import type { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { NdJsonLineAccumulatorImpl } from "./NdJsonLineAccumulator.ts";

const table: Config.ResolvedTable = {
    name: "test-table",
    description: "test",
    writable: false,
    awsProfile: "default",
    region: "us-east-1"
};

function makeLogger(): Logger.Interface {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        done: vi.fn(),
        attachFile: vi.fn()
    };
}

describe("NdJsonLineAccumulatorImpl", () => {

    let logger: Logger.Interface;
    let handleMock: ReturnType<typeof vi.fn>;
    let handler: ParseNdJsonErrorHandler.Interface;
    let accumulator: NdJsonLineAccumulatorImpl;

    beforeEach(() => {
        logger = makeLogger();
        handleMock = vi.fn().mockResolvedValue(null);
        handler = { handle: handleMock };
        accumulator = new NdJsonLineAccumulatorImpl(logger, handler);
    });

    describe("feed — no pending lines", () => {
        it("returns a parsed record when the line is valid JSON", async () => {
            const result = await accumulator.feed('{"pk":"user#1","sk":"profile"}', table);
            expect(result).toEqual({ pk: "user#1", sk: "profile" });
        });

        it("returns null and starts accumulating when the line is not valid JSON", async () => {
            const result = await accumulator.feed('{"pk":"user#1",', table);
            expect(result).toBeNull();
        });
    });

    describe("feed — with pending lines, newline join succeeds", () => {
        it("returns the combined record when pending + line joins with newline parse correctly", async () => {
            await accumulator.feed('{"pk":', table);
            const result = await accumulator.feed('"user#1"}', table);
            expect(result).toEqual({ pk: "user#1" });
        });

        it("clears pending after a successful newline-joined parse", async () => {
            await accumulator.feed('{"pk":', table);
            await accumulator.feed('"user#1"}', table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
        });
    });

    describe("feed — with pending lines, empty-string join succeeds", () => {
        it("returns the combined record when lines must be joined with empty string", async () => {
            // Literal newline inside a string value — newline join would produce invalid JSON
            await accumulator.feed('{"pk":"user#1","data":"val', table);
            const result = await accumulator.feed('ue"}', table);
            expect(result).toEqual({ pk: "user#1", data: "value" });
        });
    });

    describe("feed — with pending lines, current line succeeds alone", () => {
        it("discards pending, calls handler, and returns the standalone record", async () => {
            await accumulator.feed("{bad json", table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
            expect(handleMock).toHaveBeenCalledOnce();
        });

        it("passes the joined pending content to the handler as the line field", async () => {
            await accumulator.feed("line one", table);
            await accumulator.feed("line two", table);
            await accumulator.feed('{"pk":"user#3"}', table);
            const call = handleMock.mock.calls[0]![0] as Parameters<ParseNdJsonErrorHandler.Interface["handle"]>[0];
            expect(call.line).toBe("line one\nline two");
            expect(call.table).toBe(table);
        });

        it("clears pending after discard so subsequent lines start fresh", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.feed('{"pk":"user#1"}', table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
        });
    });

    describe("feed — with pending lines, all strategies fail", () => {
        it("keeps accumulating and returns null when no join strategy succeeds", async () => {
            await accumulator.feed('{"pk":', table);
            const result = await accumulator.feed('"sk":', table);
            expect(result).toBeNull();
            expect(handleMock).not.toHaveBeenCalled();
        });
    });

    describe("flush", () => {
        it("is a no-op when pending is empty", async () => {
            await accumulator.flush(table);
            expect(handleMock).not.toHaveBeenCalled();
        });

        it("calls handler with accumulated content when pending is non-empty", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.feed("json", table);
            await accumulator.flush(table);
            expect(handleMock).toHaveBeenCalledOnce();
            const call = handleMock.mock.calls[0]![0] as Parameters<ParseNdJsonErrorHandler.Interface["handle"]>[0];
            expect(call.line).toBe("{bad\njson");
            expect(call.table).toBe(table);
        });

        it("clears pending after flush", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.flush(table);
            await accumulator.flush(table);
            expect(handleMock).toHaveBeenCalledOnce();
        });
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /path/to/dynamodb-extract
yarn vitest run src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts
```

Expected: FAIL — `NdJsonLineAccumulatorImpl` is not exported (file does not exist yet).

- [ ] **Step 3: Create the implementation**

`src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.ts`:

```typescript
import { Logger } from "~/features/Logger/index.ts";
import { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { NdJsonLineAccumulator as NdJsonLineAccumulatorAbstraction } from "./abstractions/index.ts";

export class NdJsonLineAccumulatorImpl
    implements NdJsonLineAccumulatorAbstraction.Interface
{
    private pending: string[] = [];

    public constructor(
        private readonly logger: Logger.Interface,
        private readonly handler: ParseNdJsonErrorHandler.Interface
    ) {}

    public async feed(
        line: string,
        table: Config.ResolvedTable
    ): Promise<Record<string, unknown> | null> {
        if (this.pending.length === 0) {
            try {
                return JSON.parse(line) as Record<string, unknown>;
            } catch (_error) {
                this.logger.debug(`Failed to parse line, accumulating`);
                this.pending.push(line);
                return null;
            }
        }

        try {
            const combined = [...this.pending, line].join("\n");
            const record = JSON.parse(combined) as Record<string, unknown>;
            this.pending = [];
            return record;
        } catch (_error) {
            this.logger.debug(`Newline-joined accumulation did not parse, trying empty-string join`);
        }

        try {
            const combined = [...this.pending, line].join("");
            const record = JSON.parse(combined) as Record<string, unknown>;
            this.pending = [];
            return record;
        } catch (_error) {
            this.logger.debug(`Empty-string-joined accumulation did not parse, trying line alone`);
        }

        try {
            const record = JSON.parse(line) as Record<string, unknown>;
            const discardCount = this.pending.length;
            const discarded = this.pending.join("\n");
            this.pending = [];
            this.logger.warn(`Discarding ${discardCount} accumulated line(s) that could not form valid JSON`);
            await this.handler.handle({
                table,
                line: discarded,
                error: new Error("Accumulated lines could not form valid JSON")
            });
            return record;
        } catch (_error) {
            this.pending.push(line);
            return null;
        }
    }

    public async flush(table: Config.ResolvedTable): Promise<void> {
        if (this.pending.length === 0) {
            return;
        }
        const discarded = this.pending.join("\n");
        this.pending = [];
        await this.handler.handle({
            table,
            line: discarded,
            error: new Error("Unexpected end of file while accumulating lines")
        });
    }
}

export const NdJsonLineAccumulator = NdJsonLineAccumulatorAbstraction.createImplementation({
    implementation: NdJsonLineAccumulatorImpl,
    dependencies: [Logger, ParseNdJsonErrorHandler]
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn vitest run src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.ts src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.test.ts
git commit -m "feat(NdJsonLineAccumulator): add implementation and tests"
```

---

## Task 3: Feature registration and barrel

**Files:**
- Create: `src/features/NdJsonLineAccumulator/feature.ts`
- Create: `src/features/NdJsonLineAccumulator/index.ts`

- [ ] **Step 1: Create feature.ts**

`src/features/NdJsonLineAccumulator/feature.ts`:

```typescript
import { createFeature } from "~/base/index.ts";
import { NdJsonLineAccumulator } from "./NdJsonLineAccumulator.ts";

export const NdJsonLineAccumulatorFeature = createFeature({
    name: "Upload/NdJsonLineAccumulatorFeature",
    register(container) {
        container.register(NdJsonLineAccumulator).inSingletonScope();
    }
});
```

- [ ] **Step 2: Create index.ts**

`src/features/NdJsonLineAccumulator/index.ts`:

```typescript
export { NdJsonLineAccumulator } from "./abstractions/index.ts";
export { NdJsonLineAccumulatorFeature } from "./feature.ts";
```

- [ ] **Step 3: Commit**

```bash
git add src/features/NdJsonLineAccumulator/feature.ts src/features/NdJsonLineAccumulator/index.ts
git commit -m "feat(NdJsonLineAccumulator): add feature registration and barrel"
```

---

## Task 4: Wire up bootstrap and public exports

**Files:**
- Modify: `src/bootstrap.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Register the feature in bootstrap.ts**

In `src/bootstrap.ts`, add the import and registration. The full file after edits:

```typescript
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
import { NdJsonLineAccumulatorFeature } from "~/features/NdJsonLineAccumulator/index.ts";
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
    NdJsonLineAccumulatorFeature.register(container);

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
```

- [ ] **Step 2: Export NdJsonLineAccumulator from src/index.ts**

In `src/index.ts`, add the export. Full file after edits:

```typescript
export { defineConfig } from "./features/Config/index.ts";
export { ParseNdJsonErrorHandler } from "./features/ParseNdJsonErrorHandler/index.ts";
export { NdJsonLineAccumulator } from "./features/NdJsonLineAccumulator/index.ts";
export { Logger } from "./features/Logger/index.ts";
export { createExtensions } from "~/utils/createExtensions.ts";
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
yarn vitest run
```

Expected: all existing tests pass, new tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/bootstrap.ts src/index.ts
git commit -m "feat(NdJsonLineAccumulator): register feature and export from public barrel"
```

---

## Task 5: Update Upload.ts

**Files:**
- Modify: `src/features/Upload/Upload.ts`

- [ ] **Step 1: Replace the implementation**

Replace the full contents of `src/features/Upload/Upload.ts` with:

```typescript
import type { BatchWriteCommandInput, BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { ClientFactory } from "~/features/AwsClient/index.ts";
import { Logger } from "~/features/Logger/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { NdJsonLineAccumulator } from "~/features/NdJsonLineAccumulator/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { Upload as UploadAbstraction } from "./abstractions/index.ts";

const CHUNK_SIZE = 25;
const BACKOFF_MS = 500;

class UploadImpl implements UploadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly paths: Paths.Interface,
        private readonly clientFactory: ClientFactory.Interface,
        private readonly accumulator: NdJsonLineAccumulator.Interface
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
            const parsed = await this.accumulator.feed(line, table);
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
        await this.accumulator.flush(table);
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
}

export const Upload = UploadAbstraction.createImplementation({
    implementation: UploadImpl,
    dependencies: [Logger, Paths, ClientFactory, NdJsonLineAccumulator]
});
```

- [ ] **Step 2: Run the full test suite**

```bash
yarn vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/Upload/Upload.ts
git commit -m "feat(Upload): use NdJsonLineAccumulator instead of direct ParseNdJsonErrorHandler"
```
