# Agent instructions

You are working on **`dynamodb-extract`**, an interactive CLI that downloads DynamoDB tables to JSON/NDJSON files and uploads files back into tables.

## Orient yourself — read these first

1. `README.md` — user-facing: what the tool does, how to set up `config.ts`, where downloads go.
2. `docs/webiny-di-guide.md` — conventions for `@webiny/di`. Critical if you're touching any DI code. Read §1 and §6 in full.
3. `docs/superpowers/specs/` and `docs/superpowers/plans/` — historical design docs and plans; kept for context, work already landed.

`docs/webiny-di-guide.md` §6 is the canonical reference for feature folder layout: five file templates (`abstractions/FeatureName.ts`, `abstractions/index.ts`, `FeatureName.ts`, `feature.ts`, `index.ts`) plus the explanation of module-level `I`-interfaces + namespace facade.

## Current state

DI refactor is complete. `src/bootstrap.ts` is the composition root; `src/index.ts` is a thin CLI entry. Legacy directories (`src/aws/`, `src/commands/`, `src/config/`) are gone. 65 vitest tests run against dynalite.

### Feature inventory (`src/features/`)

| Feature | What it does |
|---|---|
| `Cli` | Top-level interactive loop — prompts for action, delegates to Download/Upload |
| `Config` | Loads + validates + resolves per-table defaults from `config.ts` |
| `DynamoDbClient` | `DynamoDbClient` (scan/batchPut with retry) + `DynamoDbClientFactory` (creates per-table clients) |
| `Download` | Scans a table and writes NDJSON or JSON to disk. **Parallel-segment path writes each segment to its own temp file (`destPath.seg{N}`) then concatenates them in order.** See below. |
| `Upload` | Reads NDJSON or JSON from disk and batch-writes to a table; supports resume-from-line |
| `Logger` | Pino-backed logger; level + optional file sink configurable via env vars |
| `NdJsonLineAccumulator` | Handles NDJSON lines split across multiple readline lines (embedded newlines in values) |
| `ParseNdJsonErrorHandler` | Error policy for unparseable NDJSON lines (skip or substitute) |
| `Paths` | File-path helpers — output paths, format detection from extension |
| `Prompter` | `enquirer`-backed interactive prompts |
| `RecordModifier` | Per-table hook for transforming records before upload |
| `Session` | Persists last-used table / file between runs |
| `WriteLogMapper` | Maps a written record to a log-friendly payload (keys only by default) |

### Download — parallel segment temp files

When `segments > 1`, `Download` fans out to N workers that each write to `destPath.seg{N}`. After all workers finish, `concatenateSegments` pipes them sequentially into `destPath` and `deleteSegmentFiles` cleans up in `finally`. This eliminates the shared-stream concurrency issue that could interleave writes. Memory usage is bounded regardless of file size (chunk-based streaming throughout).

## Critical conventions (non-negotiable)

- **`@webiny/di` naming:** abstraction token + `createImplementation` export share the same short name (e.g. `Config`, not `DefaultConfig` or `ConfigAbstraction`). The impl file uses a local rename alias — `import { Config as ConfigAbstraction } from "./abstractions/index.ts"` — so consumers never see "Abstraction" or "Default" suffixes anywhere.
- **Interface pattern:** `I`-prefixed interfaces declared at module scope (exported, because `isolatedModules` requires it); namespace is a facade that aliases them under public names (`Interface`, `RunOptions`, etc.). See `docs/webiny-di-guide.md` §6.
- **Feature area naming:** always ≥ 2 levels, e.g. `"Config/Config"`, `"Aws/ClientFactory"`, `"Commands/Download"`.
- **Feature `index.ts`:** exports the abstraction token + feature only. **Never re-export the `createImplementation` output** from the feature's public surface — that stays internal.
- **Method signatures:** options-object style (`run(options: X.RunOptions)`), not positional. Easier to extend later.
- **No inline structural types** in generics, params, or return types. Extract every non-primitive type to a named `interface` / `type`.
- **House rules:** every class method has an explicit `public` / `private` / `protected` modifier; single-line `if` / `for` always with braces.
- **Path alias** `~/* → src/*` is configured in `tsconfig.json`. Use it for all intra-src imports (both inside `src/` and from `__tests__/`).
- **Lifetime:** stateless services register as singletons (`.inSingletonScope()`).
- **No `ContainerToken` yet** — not introduced in this codebase. Don't add without asking.
- **No `aws-sdk-client-mock`** — tests use `dynalite` (local DDB emulator). The vitest `globalSetup` starts dynalite and sets `AWS_ENDPOINT_URL_DYNAMODB`; `ClientFactory` routes at it via that env var without code changes (uses `fromEnv` when the env var is set, `fromNodeProviderChain` otherwise).
- **`reflect-metadata`** is loaded by `@webiny/di` internally. Never `import "reflect-metadata"` in user code.

## Commands

```sh
yarn start          # launch the CLI
yarn ts-check       # TypeScript compile check (no emit)
yarn format:fix     # apply oxfmt formatter (run before committing)
yarn format:check   # assert formatted (read-only)
yarn test           # vitest run + coverage
yarn test:watch     # vitest watch (no coverage)
```

Project uses Yarn v4 (Berry) — `yarn install` sets that up via a `postinstall` hook. Node 24 ESM. TypeScript with `nodenext`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

## Asking the user

- **One question at a time**, with your recommended answer. Don't batch questions — the user has told agents this explicitly.
- **For design-like decisions**, use `superpowers:brainstorming` or invoke the project-local `grill-me` skill (in `.claude/skills/grill-me/`) for relentless one-at-a-time decision-tree walkthroughs.
- **For implementation from a spec**, use `superpowers:writing-plans` then `subagent-driven-development` or `executing-plans`.
- **Before claiming work is complete**, use `superpowers:verification-before-completion` — run `yarn ts-check && yarn format:check && yarn test` and confirm output before making success claims.

## Things not to do

- Don't commit `config.ts` — it's gitignored and per-user. `config.example.ts` is the committed template.
- Don't commit files under `./data/` — also gitignored. That folder holds large exported tables.
- Don't add fallback handling / retries / error wrapping for scenarios that can't happen. Only validate at system boundaries.
- Don't "improve" type signatures on your own initiative with extra `as` casts or redundant annotations. The plan's code is already type-correct under strict mode.
- Don't introduce new abstractions or refactor outside the scope the user asked for. Flag and ask.
- Don't push to `origin` without explicit instruction. The remote tracks older states; anything pushed from this branch likely needs `--force`.
