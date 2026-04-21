# dynamodb-extract refactor — design

**Date:** 2026-04-21
**Status:** Implemented. Amended 2026-04-21 with mid-flight additions (see "Amendments" at bottom).

## Goal

Turn the current single-table, two-script CLI into a multi-table, guided CLI where the user picks the action and the table (or source file) interactively. Keep the existing download/send behavior; restructure the code and UX around it.

## Non-goals

The following were explicitly deferred and must not be introduced by this refactor:

- Streaming / NDJSON format (kept as single pretty-printed JSON array for now).
- Parallel scan (`Segment` / `TotalSegments`).
- Exponential backoff with jitter (keep current fixed 500 ms backoff).
- Concurrent batch writes.
- Resume-from-`LastEvaluatedKey`.

These are candidates for a later iteration, not this one.

## Config

### Shape

`config.ts` at the repo root is user-edited and uses a typed `defineConfig` helper:

```ts
import { defineConfig } from "./src/config/define.js";

export default defineConfig({
  defaults: {
    awsProfile: "default",
    region: "eu-central-1",
  },
  tables: [
    { name: "wby-webiny-0ec9796", description: "Webiny default" },
    { name: "wby-webiny-prod", description: "Production", awsProfile: "prod", region: "us-east-1" },
  ],
});
```

- `defaults.awsProfile` and `defaults.region` are required.
- Each entry in `tables` requires `name` and `description`. `description` must be ≤ 25 characters (used to derive the exported file name — see "Data format and file naming").
- `awsProfile` and `region` are optional and, when omitted, inherit from `defaults`.

### `defineConfig` helper and schema

`src/config/define.ts` exports a zod schema + the inferred types + a passthrough `defineConfig` helper:

```ts
import { z } from "zod";

const nonEmpty = z.string().min(1);

export const TableConfigSchema = z.object({
  name: nonEmpty,
  description: nonEmpty.max(25),
  awsProfile: nonEmpty.optional(),
  region: nonEmpty.optional(),
});

export const ConfigSchema = z.object({
  defaults: z.object({ awsProfile: nonEmpty, region: nonEmpty }),
  tables: z.array(TableConfigSchema).min(1),
}).superRefine(/* uniqueness for names + descriptions */);

export type Config = z.infer<typeof ConfigSchema>;
export interface ResolvedTable { name: string; description: string; awsProfile: string; region: string; }
export const defineConfig = (config: Config): Config => config;
```

The helper exists purely for IntelliSense + compile-time type checking on the user-authored config. The zod schema does the runtime work.

### Runtime validation

`src/config/load.ts` imports the user's `config.ts` and `ConfigSchema.safeParse`s it at startup. Errors must be human-readable and prefixed with `config.ts:` and the offending zod path (e.g. `config.ts: tables.1.description: description must be 25 characters or fewer`). What the schema enforces:

- `tables` is a non-empty array.
- Each `tables[i].name` is a non-empty string; table names are unique across entries.
- Each `tables[i].description` is a non-empty string of ≤ 25 characters; descriptions are unique across entries (required because descriptions derive filenames — duplicates would collide).
- Where present, `awsProfile` and `region` are non-empty strings.
- `defaults.awsProfile` and `defaults.region` are non-empty strings.

### Resolved view

`loadConfig()` returns a `ResolvedTable[]` directly — defaults are merged into each table so downstream code always sees fully-resolved `{ name, description, awsProfile, region }`. All commands consume the resolved view — no `undefined` handling scattered around.

## File and folder layout

```
config.ts                        # user-edited config (uses defineConfig)

src/
  index.ts                       # yarn start entry: load config, run flow
  config/
    define.ts                    # defineConfig() + Config / TableConfig / Defaults types
    load.ts                      # import + validate config.ts; resolve defaults
  aws/
    client.ts                    # createClient({awsProfile, region}) -> DocumentClient
  prompts/
    action.ts                    # "Download or Send?"
    table.ts                     # "Which table?"
    sourceFile.ts                # "Which file to send?"
    overwrite.ts                 # "Overwrite / Rename / Cancel"
  commands/
    download.ts                  # runDownload(table, destPath)
    send.ts                      # runSend(sourcePath, table)
  lib/
    paths.ts                     # toCamelCase, dataFilePath, listDataFiles
```

### What goes away

- `src/download.ts` (replaced by `src/commands/download.ts`).
- `src/send.ts` (replaced by `src/commands/send.ts`).
- `src/client.ts` (replaced by `src/aws/client.ts` as a factory, not a singleton).
- The single-table layout of `config.ts`.
- The `run:download` and `run:send` scripts in `package.json`.
- The stale `// TODO put your AWS profile name here` comment from the old `client.ts`.
- The `@ts-expect-error` in `send.ts` (resolved by typing `unprocessed` as `BatchWriteCommandInput["RequestItems"]`).

### `package.json` changes

- `scripts` becomes:
  ```json
  {
    "start": "tsx src/index.ts",
    "postinstall": "yarn set version berry"
  }
  ```
- New dependencies: `@inquirer/prompts` (^8.4.2), `zod` (^4).

### What stays

`config.ts` at the repo root (requested), `./data/` as the storage folder, `tsconfig.json`, all AWS SDK dependencies, and the Yarn Berry postinstall.

## CLI flow

Entry: `yarn start` → `src/index.ts`.

1. Load + validate `config.ts`. On failure: print the error, exit non-zero.
2. Prompt — **action**: `Download` / `Send` / `Exit`.
3. Branch:

### Download branch

- Prompt — **table**: list from `config.tables`, each entry labeled `<description> — <name> (<region>, profile: <profile>)` (e.g. `Production — wby-webiny-prod (us-east-1, profile: prod)`). Description leads so the user immediately sees the human-readable name; the raw table name is still shown so there's no ambiguity about what the operation targets.
- Compute `destPath = data/<toCamelCase(table.description)>.json` (e.g. `"Webiny default"` → `data/webinyDefault.json`).
- If `destPath` exists, prompt **Overwrite / Rename / Cancel**:
  - **Overwrite** — proceed, file is replaced.
  - **Rename** — prompt for a new filename (basename only; `.json` auto-appended if missing). The basename (excluding `.json`) must be ≤ 25 characters, mirroring the description cap. If the new path also exists, re-prompt with the same three options against the new path. `Cancel` always ends the flow, so no infinite loop.
  - **Cancel** — exit cleanly.
- Run `runDownload(resolvedTable, finalPath)`.
- On completion: `"Exported N items to data/<file>.json"`.

### Send branch

- Prompt — **source file**: list every `*.json` in `data/`, sorted alphabetically. If `data/` contains no JSON files, print a message and exit.
- Prompt — **destination table**: list from `config.tables`, labeled with description + name + region + profile (same format as download).
- Confirmation — prints the full target line (`About to write <file> → <table> (<region>, profile: <profile>)`) and then requires the user to **type the destination table name** exactly. Yes/no isn't acceptable because a stray keystroke can trigger destruction; typing the full table name forces a deliberate action. Mismatch re-prompts; Ctrl+C cancels cleanly (same path as all other prompts).
- Run `runSend(sourcePath, resolvedTable)`.
- On completion: `"Wrote N items to <table>"`.

### Exit / cancel behavior

Any `Cancel`, `Exit`, or `No` selection ends the process with a clean zero exit. The script does not loop back to the action menu.

### Errors

AWS errors (throttling, access denied, etc.) bubble up with a readable prefix (`"Download failed: <message>"` or `"Send failed: <message>"`) and the process exits non-zero. No silent swallow.

## Command internals

### `runDownload(table, destPath)` — `src/commands/download.ts`

- Builds a client via `createClient(table)`.
- Paginated `ScanCommand` loop, same structure as today: `do { scan(ExclusiveStartKey); accumulate; } while (LastEvaluatedKey)`.
- Logs progress after each page: `"Scanned N items..."`.
- On completion, writes `JSON.stringify(items, null, 2)` to `destPath`. Single write, same format as today.
- AWS errors rethrown with `"Download failed: <message>"` prefix.

### `runSend(sourcePath, table)` — `src/commands/send.ts`

- Builds a client via `createClient(table)`.
- `JSON.parse(readFileSync(sourcePath, "utf-8"))`, cast to `Record<string, unknown>[]`.
- Chunks of 25, `BatchWriteCommand` per chunk. Unprocessed-items retry loop with fixed 500 ms backoff, same as today.
- `unprocessed` typed as `BatchWriteCommandInput["RequestItems"]`. No `@ts-expect-error`.
- Logs `"Written N/M"` after each chunk.
- AWS errors rethrown with `"Send failed: <message>"` prefix.

### `createClient({awsProfile, region})` — `src/aws/client.ts`

Exactly today's `DocumentClient.from(new DynamoDBClient({region, credentials: fromIni({profile: awsProfile})}))`, but as a function of the resolved table config. Each command call creates its own client — cheap, and the natural way to support two different profiles within a single process if a future workflow needs it.

## Data format and file naming

- Format: single pretty-printed JSON array, same as today.
- Storage dir: `./data/`.
- File naming: `<toCamelCase(table.description)>.json`. Example: description `"Webiny default"` → `data/webinyDefault.json`. The camelCase helper lives in `src/lib/paths.ts`. This is why descriptions must be unique — duplicate descriptions would collide on filename.
- Send does **not** require the filename to match any table — the user picks the source file and the destination table independently.

## Dependencies added

- `@inquirer/prompts` (^8.4.2) — interactive prompts (action, table, source file, overwrite, confirmation). Modern ESM-native named-export API; no separate `@types/*` package needed.
- `zod` (^4) — schema-based runtime validation of `config.ts`.

## Out of scope for this refactor

Reiterated for clarity: streaming/NDJSON, parallel scan, exponential backoff, concurrent batch writes, and resume-from-checkpoint are all deferred. The behavioral footprint of this change is: same download, same send, same backoff — only the structure, config, and UX change.

## Amendments (post-approval changes made during implementation)

1. **Required `description` field per table.** Added because raw DynamoDB table names (e.g. `wby-webiny-0ec9796`) aren't human-readable in the selection prompt. Description is now the human-facing name in the table label and the source for the exported filename.
2. **Filename derived from camelCased description, not table name.** Direct consequence of #1. Motivates the uniqueness constraint on descriptions.
3. **25-character cap on description** (enforced by the zod schema). Keeps exported filenames a reasonable length. Mirrored in the rename-prompt validator (excluding the `.json` suffix).
4. **Zod replaces the hand-rolled validator.** Same rules as originally specified, plus the cap and description-uniqueness check, expressed as a schema. Error messages still surface through `ConfigError` with the `config.ts:` prefix.
5. **`loadConfig()` returns `ResolvedTable[]` directly** (the original `{ config, tables }` shape had a dead `config` field — the raw, unresolved config wasn't consumed by any caller).
6. **`@inquirer/prompts` pinned at `^8.4.2`** (not `^7.0.0` as first written — latest major at time of implementation; no API break with what this refactor uses).
7. **`config.ts` is no longer committed.** A committed `config.example.ts` acts as a template; `config.ts` is gitignored and per-user. `loadConfig()` uses a dynamic import so a missing `config.ts` surfaces as `"config.ts: file not found. Copy config.example.ts to config.ts and edit."` instead of a raw Node `ERR_MODULE_NOT_FOUND`. `loadConfig` is now `async`.
8. **Send confirmation requires typing the destination table name.** Replaces the `confirm({ default: false, ... })` prompt. The y/N confirmation was considered too easy to mis-press for a destructive operation. A new `src/prompts/confirmSend.ts` prints the target summary and uses an `input` with validation that requires the user to type the exact `table.name` value before `runSend` is called.
