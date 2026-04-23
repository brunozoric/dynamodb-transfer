# Upload Resume-From Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `startFrom` prompt to the upload flow so users can skip already-uploaded items when resuming after a failure.

**Architecture:** `startFrom: number` is threaded from `Prompter.startFrom()` through `Cli.runUpload()` into `Upload.run()`. `sendJson` loops from `startFrom` in the full array; `sendNdjson` tracks a `lineIndex` counter and skips lines until it reaches `startFrom`. Confirmation message appends a resume note when `startFrom > 0`.

**Tech Stack:** TypeScript (nodenext strict), `@inquirer/prompts` (`input`), vitest + dynalite.

---

### Task 1: Add `startFrom` to Upload abstraction and write failing tests

**Files:**
- Modify: `src/features/Upload/abstractions/Upload.ts`
- Modify: `__tests__/features/Upload.test.ts`

- [ ] **Step 1: Add `startFrom: number` to `IUploadRunOptions`**

Full replacement of `src/features/Upload/abstractions/Upload.ts`:

```typescript
import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface IUpload {
    run(options: IUploadRunOptions): Promise<void>;
}

export interface IUploadRunOptions {
    sourcePath: string;
    table: Config.ResolvedTable;
    startFrom: number;
}

export const Upload = createAbstraction<IUpload>("Commands/Upload");

export namespace Upload {
    export type Interface = IUpload;
    export type RunOptions = IUploadRunOptions;
}
```

- [ ] **Step 2: Update existing Upload tests to pass `startFrom: 0`**

In `__tests__/features/Upload.test.ts` there are 4 calls to `upload.run(...)`. Add `startFrom: 0` to each:

```typescript
// line ~58 — NDJSON test
await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

// line ~76 — JSON test
await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

// line ~97 — chunking test
await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

// line ~110 — error test
await expect(
  upload.run({ sourcePath, table: makeTable("does-not-exist"), startFrom: 0 })
).rejects.toThrowError(/^Upload failed:/);
```

- [ ] **Step 3: Add two new failing tests for resume-from behavior**

Append inside the `describe("Upload", ...)` block:

```typescript
  it("resumes NDJSON upload from a given line, skipping earlier items", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    const items = [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 },
      { PK: "c", value: 3 }
    ];
    writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 1 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["b", "c"]);
  });

  it("resumes JSON upload from a given index, skipping earlier items", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.json");
    const items = [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 },
      { PK: "c", value: 3 }
    ];
    writeFileSync(sourcePath, JSON.stringify(items));

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 2 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.PK).toBe("c");
  });
```

- [ ] **Step 4: Run tests to verify new tests fail**

```bash
yarn test --reporter=verbose 2>&1 | tail -20
```

Expected: 2 new resume tests fail (Upload.ts ignores `startFrom` so all 3 items land in the table regardless).

- [ ] **Step 5: Commit**

```bash
git add src/features/Upload/abstractions/Upload.ts __tests__/features/Upload.test.ts
git commit -m "test(upload): add failing resume-from tests + add startFrom to RunOptions"
```

---

### Task 2: Implement skip logic in `Upload.ts`

**Files:**
- Modify: `src/features/Upload/Upload.ts`

- [ ] **Step 1: Update `run()` to destructure and pass `startFrom`**

Replace the `run` method:

```typescript
public async run(options: UploadAbstraction.RunOptions): Promise<void> {
    const { sourcePath, table, startFrom } = options;
    const client = this.clientFactory.create(table);
    const format = this.paths.detectFormat(sourcePath);
    try {
        if (format === "ndjson") {
            await this.sendNdjson(client, table.name, sourcePath, startFrom);
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
```

- [ ] **Step 2: Replace `sendJson` to loop from `startFrom`**

Replace the `sendJson` method (loop starts at `startFrom`, `written` initialises to `startFrom` so progress shows cumulative position, e.g. `Written 76/100` when resuming from 75):

```typescript
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
```

- [ ] **Step 3: Replace `sendNdjson` to skip lines before `startFrom`**

`lineIndex` counts only non-empty lines (empty lines don't shift the user-visible position). Replace the `sendNdjson` method:

```typescript
private async sendNdjson(
    client: ClientFactory.Client,
    tableName: string,
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
        buffer.push(this.getParsed(line));
        if (buffer.length >= CHUNK_SIZE) {
            await this.sendChunk(client, tableName, buffer);
            written += buffer.length;
            this.logger.info(`Written ${startFrom + written} items...`);
            buffer = [];
        }
    }
    if (buffer.length > 0) {
        await this.sendChunk(client, tableName, buffer);
        written += buffer.length;
    }
    this.logger.done(`Wrote ${written} items to ${tableName}`);
}
```

- [ ] **Step 4: Run tests and confirm all pass**

```bash
yarn test --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass, including the 2 new resume-from tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/Upload/Upload.ts
git commit -m "feat(upload): skip items before startFrom in sendJson and sendNdjson"
```

---

### Task 3: Update Prompter abstraction and `scriptedPrompter`

**Files:**
- Modify: `src/features/Prompter/abstractions/Prompter.ts`
- Modify: `__tests__/helpers/scriptedPrompter.ts`

- [ ] **Step 1: Update `IPrompter` and `IConfirmUploadOptions`**

Full replacement of `src/features/Prompter/abstractions/Prompter.ts`:

```typescript
import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";

export type IAction = "download" | "upload" | "exit";

export interface IPrompter {
    action(): Promise<IAction>;
    table(options: ITableOptions): Promise<Config.ResolvedTable>;
    downloadFormat(options: IDownloadFormatOptions): Promise<Paths.DownloadFormat>;
    segments(): Promise<number>;
    sourceFile(): Promise<string | null>;
    destPath(options: IDestPathOptions): Promise<string | null>;
    confirmUpload(options: IConfirmUploadOptions): Promise<void>;
    logToFile(): Promise<boolean>;
    startFrom(): Promise<number>;
}

export interface ITableOptions {
    tables: Config.ResolvedTable[];
    message: string;
}

export interface IDownloadFormatOptions {
    segments: number;
}

export interface IDestPathOptions {
    initialPath: string;
    extension: string;
}

export interface IConfirmUploadOptions {
    sourcePath: string;
    table: Config.ResolvedTable;
    startFrom: number;
    format: Paths.DownloadFormat | null;
}

export const Prompter = createAbstraction<IPrompter>("Ui/Prompter");

export namespace Prompter {
    export type Interface = IPrompter;
    export type Action = IAction;
    export type TableOptions = ITableOptions;
    export type DownloadFormatOptions = IDownloadFormatOptions;
    export type DestPathOptions = IDestPathOptions;
    export type ConfirmUploadOptions = IConfirmUploadOptions;
}
```

- [ ] **Step 2: Add `startFrom` to `ScriptedPrompterSpec`**

Full replacement of `__tests__/helpers/scriptedPrompter.ts`:

```typescript
import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";
import type { Prompter } from "~/features/Prompter/index.ts";

export interface ScriptedPrompterSpec {
  action?: () => Promise<Prompter.Action>;
  table?: (options: Prompter.TableOptions) => Promise<Config.ResolvedTable>;
  downloadFormat?: (options: Prompter.DownloadFormatOptions) => Promise<Paths.DownloadFormat>;
  segments?: () => Promise<number>;
  sourceFile?: () => Promise<string | null>;
  destPath?: (options: Prompter.DestPathOptions) => Promise<string | null>;
  confirmUpload?: (options: Prompter.ConfirmUploadOptions) => Promise<void>;
  logToFile?: () => Promise<boolean>;
  startFrom?: () => Promise<number>;
}

function scriptedMethod<TArgs extends unknown[], TResult>(
  method: string,
  impl: ((...args: TArgs) => Promise<TResult>) | undefined
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    if (!impl) {
      throw new Error(`ScriptedPrompter: ${method}() called but not scripted`);
    }
    return impl(...args);
  };
}

export function createScriptedPrompter(spec: ScriptedPrompterSpec): Prompter.Interface {
  return {
    action: scriptedMethod("action", spec.action),
    table: scriptedMethod("table", spec.table),
    downloadFormat: scriptedMethod("downloadFormat", spec.downloadFormat),
    segments: scriptedMethod("segments", spec.segments),
    sourceFile: scriptedMethod("sourceFile", spec.sourceFile),
    destPath: scriptedMethod("destPath", spec.destPath),
    confirmUpload: scriptedMethod("confirmUpload", spec.confirmUpload),
    logToFile: scriptedMethod("logToFile", spec.logToFile),
    startFrom: scriptedMethod("startFrom", spec.startFrom)
  };
}
```

- [ ] **Step 3: Run `yarn ts-check` to confirm compile errors appear at the right places**

```bash
yarn ts-check 2>&1 | grep "error TS"
```

Expected: errors in `src/features/Prompter/Prompter.ts` (missing `startFrom` impl) and `src/features/Cli/Cli.ts` (missing `startFrom`/`format` on `confirmUpload` call, missing `startFrom` on `upload.run` call). No errors elsewhere.

- [ ] **Step 4: Commit**

```bash
git add src/features/Prompter/abstractions/Prompter.ts __tests__/helpers/scriptedPrompter.ts
git commit -m "feat(prompter): add startFrom to IPrompter interface and IConfirmUploadOptions"
```

---

### Task 4: Implement `startFrom()` and update `confirmUpload()` in `Prompter.ts`

**Files:**
- Modify: `src/features/Prompter/Prompter.ts`

- [ ] **Step 1: Add the `startFrom()` method to `PrompterImpl`**

Add this method inside `PrompterImpl` (e.g. after `logToFile`):

```typescript
public async startFrom(): Promise<number> {
    const raw = await input({
        message: "Start from index (JSON) or line (NDJSON) — 0 to start from the beginning:",
        default: "0",
        validate: value => {
            const trimmed = value.trim();
            if (!/^\d+$/.test(trimmed)) {
                return "Must be a whole number";
            }
            return true;
        }
    });
    return Number(raw.trim());
}
```

- [ ] **Step 2: Update `confirmUpload()` to show the resume note**

Replace the `confirmUpload` method:

```typescript
public async confirmUpload(options: PrompterAbstraction.ConfirmUploadOptions): Promise<void> {
    console.log("");
    const resumeNote =
        options.startFrom > 0
            ? `, starting from ${options.format === "json" ? "index" : "line"} ${options.startFrom}`
            : "";
    console.log(
        `About to write ${options.sourcePath} → ${options.table.name} (${options.table.region}, profile: ${options.table.awsProfile})${resumeNote}`
    );
    await input({
        message: `Type the destination table name to confirm (${options.table.name}), or Ctrl+C to cancel:`,
        validate: value =>
            value.trim() === options.table.name ||
            `Input does not match "${options.table.name}". Try again or press Ctrl+C to cancel.`
    });
}
```

- [ ] **Step 3: Run `yarn ts-check` — only Cli errors should remain**

```bash
yarn ts-check 2>&1 | grep "error TS"
```

Expected: only errors in `src/features/Cli/Cli.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/features/Prompter/Prompter.ts
git commit -m "feat(prompter): implement startFrom prompt and resume note in confirmUpload"
```

---

### Task 5: Wire `startFrom` through `Cli.ts` and update Cli tests

**Files:**
- Modify: `src/features/Cli/Cli.ts`
- Modify: `__tests__/features/Cli.test.ts`

- [ ] **Step 1: Update `runUpload()` in `Cli.ts`**

Replace the `runUpload` method:

```typescript
private async runUpload(tables: Config.ResolvedTable[]): Promise<void> {
    const writableTables = tables.filter(t => t.writable);
    if (writableTables.length === 0) {
        this.logger.info(
            "No writable tables in config.ts. Set `writable: true` on the table you want to upload to."
        );
        return;
    }
    const sourcePath = await this.prompter.sourceFile();
    if (sourcePath === null) {
        this.logger.info("No files in data/ to upload.");
        return;
    }
    const table = await this.prompter.table({
        tables: writableTables,
        message: "Which table should receive the data?"
    });
    const format = this.paths.detectFormat(sourcePath);
    const startFrom = await this.prompter.startFrom();
    await this.prompter.confirmUpload({ sourcePath, table, startFrom, format });
    await this.maybeAttachLogFile(table.name);
    await this.upload.run({ sourcePath, table, startFrom });
}
```

- [ ] **Step 2: Run `yarn ts-check` to confirm zero errors**

```bash
yarn ts-check 2>&1 | grep -c "error TS" || echo "0"
```

Expected: `0`

- [ ] **Step 3: Update the existing Cli upload test to script `startFrom`**

In `__tests__/features/Cli.test.ts`, inside `"runs the full upload flow end to end"`, update `createScriptedPrompter(...)`:

```typescript
container.registerInstance(
  Prompter,
  createScriptedPrompter({
    action: async () => "upload",
    sourceFile: async () => sourcePath,
    table: async ({ tables: ts }) => ts[0]!,
    startFrom: async () => 0,
    confirmUpload: async () => {
      // accept: no-op
    },
    logToFile: async () => false
  })
);
```

- [ ] **Step 4: Add a new Cli integration test for resume-from upload**

Append inside `describe("Cli", ...)`:

```typescript
  it("skips items before startFrom in the upload flow", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);

    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    writeFileSync(
      sourcePath,
      [
        JSON.stringify({ PK: "skip", v: 0 }),
        JSON.stringify({ PK: "keep", v: 1 })
      ].join("\n") + "\n"
    );

    const tables = [makeWritableTable(tableName)];
    const container = createTestContainer({ tables });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "upload",
        sourceFile: async () => sourcePath,
        table: async ({ tables: ts }) => ts[0]!,
        startFrom: async () => 1,
        confirmUpload: async () => {
          // accept: no-op
        },
        logToFile: async () => false
      })
    );

    const cli = container.resolve(Cli);
    await cli.run();

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.PK).toBe("keep");
  });
```

- [ ] **Step 5: Run all tests**

```bash
yarn test --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Format check and ts-check**

```bash
yarn ts-check && yarn format:check
```

Expected: no output (both succeed silently). If `format:check` fails, run `yarn format:fix` then re-run.

- [ ] **Step 7: Commit**

```bash
git add src/features/Cli/Cli.ts __tests__/features/Cli.test.ts
git commit -m "feat(cli): wire startFrom through upload flow"
```
