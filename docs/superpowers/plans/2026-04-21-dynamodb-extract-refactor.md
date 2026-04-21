# dynamodb-extract refactor — implementation plan

**Status:** Implemented on main (commits `430f2ba..882f4a6`). Task 15 (manual e2e smoke test against real AWS) remains for the user to run. The task-by-task code blocks below reflect the plan as written; amendments applied during implementation are listed in the "Post-implementation amendments" section at the bottom.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-table, two-script CLI into a multi-table, guided interactive CLI (`yarn start`) where the user picks the action (download/send) and then the table or source file. Behavior stays identical — structure, config, and UX change.

**Architecture:** `src/index.ts` is the entry point. It loads a validated multi-table config via `defineConfig` (with top-level defaults merged into each table), then drives one of two commands (`runDownload`, `runSend`) through `@inquirer/prompts`. Each layer — config, prompts, commands, AWS client factory, path helpers — lives in its own file under a `src/<concern>/` folder.

**Tech Stack:** TypeScript (nodenext, strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess), Node 24 ESM, tsx runner, `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` + `@aws-sdk/credential-providers`, `@inquirer/prompts`.

**Spec:** `docs/superpowers/specs/2026-04-21-dynamodb-extract-refactor-design.md`

---

## Notes on testing strategy

This plan uses **typecheck + manual smoke tests** per task, not unit tests:

- The project has no test runner, no existing tests, and the spec explicitly scopes to behavior-equivalent refactor.
- Adding a test framework (vitest/jest) is scope creep and not what the spec covers.
- Every task verifies `yarn typecheck` passes (catches most refactor errors under strict TS). The final task adds a manual smoke-test checklist against a real AWS account.
- Unit tests for download/send would have to mock the entire AWS SDK and provide minimal value for a tool whose risk is I/O, not logic. If the user later wants them, they're a clean follow-up.

---

## File layout at end of plan

```
config.ts                            # REWRITE — uses defineConfig
package.json                         # MODIFY — scripts + deps

src/
  index.ts                           # NEW
  config/
    define.ts                        # NEW
    load.ts                          # NEW
  aws/
    client.ts                        # NEW (replaces src/client.ts)
  prompts/
    action.ts                        # NEW
    table.ts                         # NEW
    sourceFile.ts                    # NEW
    overwrite.ts                     # NEW
  commands/
    download.ts                      # NEW (replaces src/download.ts)
    send.ts                          # NEW (replaces src/send.ts)
  lib/
    paths.ts                         # NEW

# DELETED
src/download.ts
src/send.ts
src/client.ts
```

---

## Task 1: Install inquirer, update package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `@inquirer/prompts` dependency and reshape scripts**

Edit `package.json` so `scripts` and `dependencies` look like this (leave `author`, `license`, `devDependencies`, `engines`, `type`, etc. unchanged):

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "postinstall": "yarn set version berry"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.1033.0",
    "@aws-sdk/credential-providers": "^3.1033.0",
    "@aws-sdk/lib-dynamodb": "^3.1033.0",
    "@inquirer/prompts": "^7.0.0",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3"
  }
}
```

Specifically: remove the `run:download` and `run:send` lines, add `start`, add `typecheck`, add `@inquirer/prompts` to deps.

- [ ] **Step 2: Install**

Run: `yarn install`
Expected: resolves without errors, `node_modules/@inquirer/prompts` exists.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add @inquirer/prompts and replace run scripts with start"
```

---

## Task 2: Add `defineConfig` helper and config types

**Files:**
- Create: `src/config/define.ts`

- [ ] **Step 1: Create `src/config/define.ts`**

```ts
export interface TableConfig {
  name: string;
  awsProfile?: string;
  region?: string;
}

export interface Defaults {
  awsProfile: string;
  region: string;
}

export interface Config {
  defaults: Defaults;
  tables: TableConfig[];
}

export interface ResolvedTable {
  name: string;
  awsProfile: string;
  region: string;
}

export const defineConfig = (config: Config): Config => config;
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors. (Note: existing `config.ts` and `src/*.ts` still use the old shape — they won't be broken yet because nothing imports `src/config/define.ts`. They'll be updated in later tasks.)

- [ ] **Step 3: Commit**

```bash
git add src/config/define.ts
git commit -m "feat(config): add defineConfig helper and config types"
```

---

## Task 3: Rewrite root `config.ts` to use `defineConfig`

**Files:**
- Modify: `config.ts`

> **Note:** after this task, `src/download.ts`, `src/send.ts`, and `src/client.ts` will fail to typecheck because they import from the old `config.ts` shape. That is expected and gets fixed when those files are deleted in Task 14. To keep intermediate tasks green, `tsconfig.json` already has `skipLibCheck`, and we will exclude the stale files by renaming them. See Step 2 below.

- [ ] **Step 1: Rewrite `config.ts`**

Replace the entire contents of `config.ts` with:

```ts
import { defineConfig } from "./src/config/define.js";

export default defineConfig({
  defaults: {
    awsProfile: "default",
    region: "eu-central-1",
  },
  tables: [
    { name: "wby-webiny-0ec9796" },
  ],
});
```

- [ ] **Step 2: Neutralize the old files so typecheck stays green**

The old `src/download.ts`, `src/send.ts`, and `src/client.ts` reference the old config shape and `DATA_DIR=./data/export.json`. Rename them to `.old` so TypeScript ignores them until Task 14 deletes them outright:

```bash
git mv src/download.ts src/download.ts.old
git mv src/send.ts src/send.ts.old
git mv src/client.ts src/client.ts.old
```

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add config.ts src/download.ts.old src/send.ts.old src/client.ts.old
git commit -m "feat(config): switch root config.ts to multi-table defineConfig shape"
```

---

## Task 4: Add config loader with validation

**Files:**
- Create: `src/config/load.ts`

- [ ] **Step 1: Create `src/config/load.ts`**

```ts
import userConfig from "../../config.js";
import type { Config, ResolvedTable } from "./define.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(`config.ts: ${message}`);
    this.name = "ConfigError";
  }
}

const ensureString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(`${path} must be a non-empty string`);
  }
  return value;
};

const validate = (config: Config): void => {
  if (!config.defaults || typeof config.defaults !== "object") {
    throw new ConfigError("defaults must be an object");
  }
  ensureString(config.defaults.awsProfile, "defaults.awsProfile");
  ensureString(config.defaults.region, "defaults.region");

  if (!Array.isArray(config.tables) || config.tables.length === 0) {
    throw new ConfigError("tables must be a non-empty array");
  }

  const seen = new Set<string>();
  config.tables.forEach((table, i) => {
    ensureString(table.name, `tables[${i}].name`);
    if (seen.has(table.name)) {
      throw new ConfigError(`tables[${i}].name is a duplicate: ${table.name}`);
    }
    seen.add(table.name);

    if (table.awsProfile !== undefined) {
      ensureString(table.awsProfile, `tables[${i}].awsProfile`);
    }
    if (table.region !== undefined) {
      ensureString(table.region, `tables[${i}].region`);
    }
  });
};

const resolve = (config: Config): ResolvedTable[] =>
  config.tables.map((table) => ({
    name: table.name,
    awsProfile: table.awsProfile ?? config.defaults.awsProfile,
    region: table.region ?? config.defaults.region,
  }));

export const loadConfig = (): { config: Config; tables: ResolvedTable[] } => {
  validate(userConfig);
  return { config: userConfig, tables: resolve(userConfig) };
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Quick runtime sanity check**

Run the loader directly and print the resolved tables:

```bash
yarn tsx -e "import('./src/config/load.js').then(({loadConfig}) => console.log(JSON.stringify(loadConfig().tables, null, 2)))"
```

Expected output:
```json
[
  {
    "name": "wby-webiny-0ec9796",
    "awsProfile": "default",
    "region": "eu-central-1"
  }
]
```

- [ ] **Step 4: Commit**

```bash
git add src/config/load.ts
git commit -m "feat(config): add loader with runtime validation and defaults resolution"
```

---

## Task 5: Add AWS client factory

**Files:**
- Create: `src/aws/client.ts`

- [ ] **Step 1: Create `src/aws/client.ts`**

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import type { ResolvedTable } from "../config/define.js";

export type Client = ReturnType<typeof DynamoDBDocumentClient.from>;

export const createClient = (table: ResolvedTable): Client =>
  DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: table.region,
      credentials: fromIni({ profile: table.awsProfile }),
    })
  );
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/aws/client.ts
git commit -m "feat(aws): add client factory keyed on resolved table config"
```

---

## Task 6: Add path helpers

**Files:**
- Create: `src/lib/paths.ts`

- [ ] **Step 1: Create `src/lib/paths.ts`**

```ts
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DATA_DIR = "data";

export const toCamelCase = (name: string): string => {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return name;
  return parts
    .map((p, i) =>
      i === 0
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join("");
};

export const dataFilePath = (tableName: string): string =>
  join(DATA_DIR, `${toCamelCase(tableName)}.json`);

export const listDataFiles = (): string[] => {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Quick runtime sanity check for `toCamelCase`**

```bash
yarn tsx -e "import('./src/lib/paths.js').then(({toCamelCase, dataFilePath}) => { console.log(toCamelCase('wby-webiny-0ec9796')); console.log(dataFilePath('wby-webiny-0ec9796')); })"
```

Expected output:
```
wbyWebiny0ec9796
data/wbyWebiny0ec9796.json
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/paths.ts
git commit -m "feat(lib): add toCamelCase, dataFilePath, listDataFiles helpers"
```

---

## Task 7: Add action prompt

**Files:**
- Create: `src/prompts/action.ts`

- [ ] **Step 1: Create `src/prompts/action.ts`**

```ts
import { select } from "@inquirer/prompts";

export type Action = "download" | "send" | "exit";

export const promptAction = (): Promise<Action> =>
  select<Action>({
    message: "What would you like to do?",
    choices: [
      { name: "Download a table", value: "download" },
      { name: "Send a file to a table", value: "send" },
      { name: "Exit", value: "exit" },
    ],
  });
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/prompts/action.ts
git commit -m "feat(prompts): add action selection prompt"
```

---

## Task 8: Add table prompt

**Files:**
- Create: `src/prompts/table.ts`

- [ ] **Step 1: Create `src/prompts/table.ts`**

```ts
import { select } from "@inquirer/prompts";
import type { ResolvedTable } from "../config/define.js";

export const promptTable = (
  tables: ResolvedTable[],
  message: string
): Promise<ResolvedTable> =>
  select<ResolvedTable>({
    message,
    choices: tables.map((table) => ({
      name: `${table.name}  (${table.region}, profile: ${table.awsProfile})`,
      value: table,
    })),
  });
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/prompts/table.ts
git commit -m "feat(prompts): add table selection prompt with region/profile label"
```

---

## Task 9: Add source file prompt

**Files:**
- Create: `src/prompts/sourceFile.ts`

- [ ] **Step 1: Create `src/prompts/sourceFile.ts`**

```ts
import { select } from "@inquirer/prompts";
import { join } from "node:path";
import { DATA_DIR, listDataFiles } from "../lib/paths.js";

export const promptSourceFile = async (): Promise<string | null> => {
  const files = listDataFiles();
  if (files.length === 0) return null;
  return select<string>({
    message: "Which file do you want to send?",
    choices: files.map((file) => ({
      name: file,
      value: join(DATA_DIR, file),
    })),
  });
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/prompts/sourceFile.ts
git commit -m "feat(prompts): add source file prompt listing data/*.json"
```

---

## Task 10: Add overwrite prompt with rename loop

**Files:**
- Create: `src/prompts/overwrite.ts`

- [ ] **Step 1: Create `src/prompts/overwrite.ts`**

```ts
import { select, input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../lib/paths.js";

type OverwriteChoice = "overwrite" | "rename" | "cancel";

export const resolveDestPath = async (initialPath: string): Promise<string | null> => {
  let path = initialPath;
  while (existsSync(path)) {
    const choice = await select<OverwriteChoice>({
      message: `${path} already exists. What do you want to do?`,
      choices: [
        { name: "Overwrite", value: "overwrite" },
        { name: "Enter a new filename", value: "rename" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (choice === "overwrite") return path;
    if (choice === "cancel") return null;
    const raw = await input({
      message: "New filename (without path):",
      validate: (value) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) return "Filename cannot be empty";
        if (trimmed.includes("/") || trimmed.includes("\\")) {
          return "Filename must not contain slashes";
        }
        return true;
      },
    });
    const trimmed = raw.trim();
    const basename = trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
    path = join(DATA_DIR, basename);
  }
  return path;
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/prompts/overwrite.ts
git commit -m "feat(prompts): add overwrite/rename/cancel resolver for dest path"
```

---

## Task 11: Implement download command

**Files:**
- Create: `src/commands/download.ts`

- [ ] **Step 1: Create `src/commands/download.ts`**

```ts
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { writeFileSync } from "node:fs";
import { createClient } from "../aws/client.js";
import type { ResolvedTable } from "../config/define.js";

export const runDownload = async (
  table: ResolvedTable,
  destPath: string
): Promise<void> => {
  const client = createClient(table);
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  try {
    do {
      const result = await client.send(
        new ScanCommand({
          TableName: table.name,
          ExclusiveStartKey,
        })
      );
      items.push(...(result.Items ?? []));
      ExclusiveStartKey = result.LastEvaluatedKey;
      console.log(`Scanned ${items.length} items...`);
    } while (ExclusiveStartKey);

    writeFileSync(destPath, JSON.stringify(items, null, 2));
    console.log(`Exported ${items.length} items to ${destPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Download failed: ${message}`);
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/download.ts
git commit -m "feat(commands): add runDownload with paginated scan + progress logs"
```

---

## Task 12: Implement send command

**Files:**
- Create: `src/commands/send.ts`

- [ ] **Step 1: Create `src/commands/send.ts`**

```ts
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "node:fs";
import { createClient } from "../aws/client.js";
import type { ResolvedTable } from "../config/define.js";

const CHUNK_SIZE = 25;
const BACKOFF_MS = 500;

export const runSend = async (
  sourcePath: string,
  table: ResolvedTable
): Promise<void> => {
  const client = createClient(table);
  const items = JSON.parse(
    readFileSync(sourcePath, "utf-8")
  ) as Record<string, unknown>[];

  const chunks: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }

  let written = 0;
  try {
    for (const chunk of chunks) {
      let unprocessed: BatchWriteCommandInput["RequestItems"] = {
        [table.name]: chunk.map((Item) => ({ PutRequest: { Item } })),
      };

      while (unprocessed !== undefined && Object.keys(unprocessed).length > 0) {
        const requestItems = unprocessed;
        const result = await client.send(
          new BatchWriteCommand({ RequestItems: requestItems })
        );
        unprocessed =
          result.UnprocessedItems &&
          Object.keys(result.UnprocessedItems).length > 0
            ? result.UnprocessedItems
            : undefined;
        if (unprocessed) {
          await new Promise((r) => setTimeout(r, BACKOFF_MS));
        }
      }

      written += chunk.length;
      console.log(`Written ${written}/${items.length}`);
    }
    console.log(`Wrote ${items.length} items to ${table.name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Send failed: ${message}`);
  }
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors. Specifically confirm there is no `@ts-expect-error` needed — `BatchWriteCommandInput["RequestItems"]` is the correct type and the `@ts-expect-error` from the old `src/send.ts` is gone.

- [ ] **Step 3: Commit**

```bash
git add src/commands/send.ts
git commit -m "feat(commands): add runSend with batched writes and typed RequestItems"
```

---

## Task 13: Wire up entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```ts
import { confirm } from "@inquirer/prompts";
import { loadConfig } from "./config/load.js";
import { runDownload } from "./commands/download.js";
import { runSend } from "./commands/send.js";
import { dataFilePath } from "./lib/paths.js";
import { promptAction } from "./prompts/action.js";
import { resolveDestPath } from "./prompts/overwrite.js";
import { promptSourceFile } from "./prompts/sourceFile.js";
import { promptTable } from "./prompts/table.js";

const main = async (): Promise<void> => {
  const { tables } = loadConfig();
  const action = await promptAction();

  if (action === "exit") return;

  if (action === "download") {
    const table = await promptTable(tables, "Which table do you want to download?");
    const initialPath = dataFilePath(table.name);
    const destPath = await resolveDestPath(initialPath);
    if (destPath === null) return;
    await runDownload(table, destPath);
    return;
  }

  // action === "send"
  const sourcePath = await promptSourceFile();
  if (sourcePath === null) {
    console.log("No files in data/ to send.");
    return;
  }
  const table = await promptTable(tables, "Which table should receive the data?");
  const ok = await confirm({
    message: `Write ${sourcePath} → ${table.name} in ${table.region}?`,
    default: false,
  });
  if (!ok) return;
  await runSend(sourcePath, table);
};

try {
  await main();
} catch (err) {
  if (err instanceof Error && err.name === "ExitPromptError") {
    // Ctrl+C on a prompt -> clean exit
    process.exit(0);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Smoke test — does the menu render?**

Run: `yarn start`
Expected: the action menu appears with three choices (`Download a table`, `Send a file to a table`, `Exit`). Press arrow keys and select `Exit`. Process exits 0.

Verify exit code: `echo $?` → `0`.

- [ ] **Step 4: Smoke test — config validation surface**

Temporarily break the config by editing `config.ts` so `tables: []`. Run `yarn start`.
Expected: prints `config.ts: tables must be a non-empty array` and exits non-zero.

Revert `config.ts` back to having one table.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): wire up guided entry point with action and table prompts"
```

---

## Task 14: Delete the now-obsolete `.old` files

**Files:**
- Delete: `src/download.ts.old`, `src/send.ts.old`, `src/client.ts.old`

- [ ] **Step 1: Delete the renamed files**

```bash
git rm src/download.ts.old src/send.ts.old src/client.ts.old
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: passes with no errors.

- [ ] **Step 3: Smoke test — nothing references the deleted files**

Run: `yarn start`
Expected: menu renders normally (same as Task 13 Step 3). Select `Exit`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove obsolete single-table download/send/client modules"
```

---

## Task 15: End-to-end smoke test against real AWS

> **Prerequisite:** the AWS profile in `config.ts` must have read access to the configured table, and you should either be pointed at a non-production table or be OK round-tripping prod data into `data/`. No code changes in this task — it's a manual acceptance checklist. Do not commit anything unless a real defect is found and fixed.

- [ ] **Step 1: Download flow — happy path**

Ensure `data/` either does not exist or does not contain `wbyWebiny0ec9796.json` (for whatever table is in `config.ts`).

Run: `yarn start`
Steps:
  1. Pick `Download a table`.
  2. Pick the single table.
  3. Watch `Scanned N items...` progress logs.

Expected: ends with `Exported N items to data/wbyWebiny0ec9796.json`. File exists, is valid JSON, item count matches the final log line.

- [ ] **Step 2: Download flow — overwrite branch**

With the file from Step 1 still present, run: `yarn start` → `Download a table` → same table.
Expected: prompt `data/wbyWebiny0ec9796.json already exists. What do you want to do?` with three options. Pick `Overwrite`. File is re-written.

- [ ] **Step 3: Download flow — rename branch**

With the file still present, run: `yarn start` → `Download a table` → same table → `Enter a new filename` → type `backup` (no extension).
Expected: file `data/backup.json` is written, original is untouched. Also verify: if you try the rename again with `backup` a second time, you get prompted again (loop works).

- [ ] **Step 4: Download flow — cancel branch**

With the file present, run: `yarn start` → `Download a table` → same table → `Cancel`.
Expected: process exits 0 cleanly, no file changes.

- [ ] **Step 5: Send flow — confirmation No**

Run: `yarn start` → `Send a file to a table` → pick a source file from the list → pick a destination table → confirmation prompt shows source/table/region → answer `n`.
Expected: process exits 0 cleanly, no DynamoDB writes.

- [ ] **Step 6: Send flow — happy path**

Run: `yarn start` → `Send a file to a table` → pick `backup.json` (from Step 3) → pick a destination table → answer `y`.
Expected: `Written N/M` logs per batch, ends with `Wrote N items to <table>`. Spot-check DynamoDB to confirm items are present.

- [ ] **Step 7: Send flow — empty data dir**

Rename `data/` to `data.bak/` temporarily. Run: `yarn start` → `Send a file to a table`.
Expected: `No files in data/ to send.` printed, process exits 0. Restore `data/`.

- [ ] **Step 8: Ctrl+C handling**

Run: `yarn start`, press Ctrl+C at the action menu.
Expected: process exits 0 cleanly with no stack trace.

- [ ] **Step 9: Done**

If all of steps 1–8 pass, the refactor is complete. No commit — the checklist itself does not modify code.

---

## Self-review notes

**Spec coverage check:**
- defineConfig helper + types + runtime validation → Tasks 2, 4.
- Root `config.ts` shape → Task 3.
- File/folder layout matches spec exactly → Tasks 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13.
- CLI flow (action → table → overwrite → run | source file → table → confirm → run) → Task 13.
- Rename loop with same three options against new path → Task 10, verified in Task 15 Step 3.
- Confirmation prompt defaults to No → Task 13 (`default: false`).
- `@ts-expect-error` removed → Task 12.
- Old files deleted → Task 14.
- `package.json` scripts + deps → Task 1.
- Same download/send behavior (format, backoff, chunk size) → Tasks 11, 12 mirror old logic.
- Ctrl+C handling → Task 13 + Task 15 Step 8.

**Placeholder scan:** no TBDs, every code step has complete code, every verification step has exact commands and expected output.

**Type consistency:** `ResolvedTable` is the type passed between `load.ts`, `client.ts`, `download.ts`, `send.ts`, `index.ts`, `prompts/table.ts`. Same field set (`name`, `awsProfile`, `region`) everywhere. `Action` is `"download" | "send" | "exit"` in both `prompts/action.ts` and `index.ts`.

---

## Post-implementation amendments

Changes applied during or just after the per-task implementation pass. Task code blocks above were NOT retroactively edited — this section documents the divergence.

### Amendment A — required `description` field per table (commit `4554936`)

Prompted by: table names like `wby-webiny-0ec9796` are opaque in the selection prompt.

- `TableConfig` and `ResolvedTable` gained a required `description: string`.
- `src/config/load.ts` validates `description` as non-empty.
- `src/prompts/table.ts` label changed to `` `${description} — ${name} (${region}, profile: ${awsProfile})` ``.
- Root `config.ts` entry updated with a description value.

### Amendment B — zod + description-derived filenames + 25-char cap + cleanup (commit `882f4a6`)

Prompted by: user requested (1) exported filename should be camelCased **description** not table name, and (2) cap of 25 characters on the "name," using zod.

- `zod ^4` added to `dependencies`.
- `src/config/define.ts` rewritten: zod schema (`ConfigSchema`) + `z.infer` types + `defineConfig` passthrough. Schema enforces non-empty strings, tables non-empty, description ≤ 25 chars, and via `superRefine`: unique table names AND unique descriptions (descriptions must be unique because they now derive filenames).
- `src/config/load.ts` rewritten to use `ConfigSchema.safeParse`. Also now returns `ResolvedTable[]` directly — the original `{ config, tables }` return had a dead `config` field (identified by the final reviewer).
- `src/index.ts` updated: `const tables = loadConfig();` (flat), and `dataFilePath(table.description)` instead of `table.name`.
- `src/prompts/overwrite.ts` rename validator gained a 25-char cap on the basename (excluding `.json`) to mirror the description cap.
- `@inquirer/prompts` bumped from `^7.0.0` to `^8.4.2` (latest; no API break on `select`/`input`/`confirm`).

### Amendment C — `send.ts` error-wrap consistency + type annotations (commits `6da3c75`, `abb5be9`)

Prompted by: Task 12 code review.

- `src/commands/send.ts` — `readFileSync` + `JSON.parse` moved inside the try block so file-not-found / parse errors get the `"Send failed: "` prefix, matching `download.ts`.
- TS needed explicit type annotations on `requestItems` and `result` inside the retry loop (TS7022 — the `let unprocessed` reassignment creates a circular narrowing). Annotations (`BatchWriteCommandInput["RequestItems"]`, `BatchWriteCommandOutput`) are used rather than `as` casts — annotations are compiler-checked, casts aren't. The final reviewer claimed `BatchWriteCommandOutput` was redundant; empirical testing showed it is not — removing it resurfaces TS7022.

### Net effect on spec coverage

The spec's "Table names are unique" rule is extended to "table names AND descriptions unique." The "File naming: `<toCamelCase(tableName)>.json`" rule is replaced by `<toCamelCase(description)>.json`. Everything else in the spec's coverage table still holds.
