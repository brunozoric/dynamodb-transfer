# NDJSON Parse Error Handler Design

**Date:** 2026-04-23  
**Status:** Approved

## Problem

When uploading NDJSON files, a line that fails JSON parsing currently aborts the entire upload. Some source files contain lines that are acceptable to skip or transform under known conditions. There is no way for a user to intercept parse failures and decide what to do.

## Solution

Two tightly related changes:

1. **`defineConfig` factory form** — always a factory, can be async, receives `{ container }` so users can register any custom DI service.
2. **`ParseNdJsonErrorHandler` DI feature** — injectable hook called on NDJSON line-parse failure. Default implementation throws (preserving current behaviour). Users override it in `config.ts`.

---

## Part 1 — `defineConfig` factory

### Current state

`defineConfig` accepts a plain `RawConfig` object. `bootstrap()` is synchronous.

### New state

`defineConfig` accepts only a factory:

```typescript
type ConfigFactory = (ctx: { container: Container }) => RawConfig | Promise<RawConfig>;

export function defineConfig(factory: ConfigFactory): ConfigFactory {
    return factory;
}
```

`bootstrap()` becomes async. It creates the container, registers all framework features (including `ParseNdJsonErrorHandlerFeature`), then imports user config, awaits the factory call with `{ container }`, validates + resolves tables, and registers the result as a static `Config` instance:

```typescript
container.registerInstance(Config, { load: async () => resolvedTables });
```

`src/cli.ts` changes to `const container = await bootstrap()`. Bootstrap errors (invalid config, factory throw) must be caught in `index.ts` — the existing try-catch only wraps `cli.run()`, so a top-level catch is needed.

`config.example.ts` is updated to the factory form.

`ConfigImpl` / `ConfigFeature` remain for tests (test container still overrides `Config` via `registerInstance` — no change to test setup).

---

## Part 2 — `ParseNdJsonErrorHandler` feature

### Abstraction (`src/features/ParseNdJsonErrorHandler/abstractions/ParseNdJsonErrorHandler.ts`)

```typescript
interface IParseNdJsonErrorHandler {
    handle(options: IHandleOptions): Promise<Record<string, unknown> | null>;
}

interface IHandleOptions {
    table: Config.ResolvedTable;
    line: string;
    error: unknown;
}
```

Return `null` → skip the line silently. Return an object → use as the parsed item. Throw → abort the upload.

### Default implementation (`src/features/ParseNdJsonErrorHandler/ParseNdJsonErrorHandler.ts`)

Throws `options.error` — identical to the current behaviour when no hook is provided.

### Upload changes (`src/features/Upload/Upload.ts`)

- `ParseNdJsonErrorHandler` is added to constructor dependencies.
- `sendNdjson` signature changes: receives `table: Config.ResolvedTable` instead of `tableName: string` (derives `table.name` for chunk calls and logging).
- `getParsed` becomes `async getParsed(line: string, table: Config.ResolvedTable): Promise<Record<string, unknown> | null>`. On `JSON.parse` failure it calls `handler.handle({ table, line, error })` and returns the result.
- In `sendNdjson`, after `getParsed`, if result is `null` the line is skipped (`continue`).

`sendJson` is unaffected — the whole file is parsed in one call, not line-by-line.

### Public barrel (`src/index.ts`)

`src/index.ts` is the user-facing public API surface. It re-exports everything a user needs to write their `config.ts`:

```typescript
export { defineConfig } from "./features/Config/index.ts";
export { ParseNdJsonErrorHandler } from "./features/ParseNdJsonErrorHandler/index.ts";
```

### User-facing API (in `config.ts`)

Users import from `./src/index.js` only — no deep feature paths:

```typescript
import { defineConfig, ParseNdJsonErrorHandler } from "./src/index.js";

class MyHandler {
    async handle({ table, line, error }) {
        if (someCondition(line)) {
            return null; // skip
        }
        throw error; // abort
    }
}

export default defineConfig(({ container }) => {
    container.registerInstance(ParseNdJsonErrorHandler, new MyHandler());
    return {
        defaults: { awsProfile: "default", region: "eu-central-1" },
        tables: [...]
    };
});
```

---

## Files changed

| File | Change |
|------|--------|
| `src/features/Config/abstractions/Config.ts` | `defineConfig` → factory-only signature |
| `src/bootstrap.ts` | async, awaits factory, registers static Config instance |
| `src/cli.ts` | `await bootstrap()`, wrap bootstrap in top-level catch |
| `src/features/ParseNdJsonErrorHandler/abstractions/ParseNdJsonErrorHandler.ts` | new abstraction |
| `src/features/ParseNdJsonErrorHandler/abstractions/index.ts` | re-exports |
| `src/features/ParseNdJsonErrorHandler/ParseNdJsonErrorHandler.ts` | default impl (throws) |
| `src/features/ParseNdJsonErrorHandler/feature.ts` | registers default impl |
| `src/features/ParseNdJsonErrorHandler/index.ts` | public surface |
| `src/features/Upload/abstractions/Upload.ts` | no change (startFrom already there) |
| `src/features/Upload/Upload.ts` | inject handler, async getParsed, pass table through sendNdjson |
| `src/features/Upload/feature.ts` | add ParseNdJsonErrorHandler to dependencies |
| `src/index.ts` | re-export `defineConfig` + `ParseNdJsonErrorHandler` for user consumption |
| `config.example.ts` | import from `./src/index.js`, use factory form |

## Out of scope

- Hook for JSON array parse errors (whole-file parse, not line-by-line).
- Hook for `sendChunk` / DynamoDB write errors.
- Any UI prompt to select parse-error behaviour at runtime.
