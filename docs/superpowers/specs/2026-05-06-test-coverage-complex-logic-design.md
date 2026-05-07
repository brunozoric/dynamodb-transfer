# Test Coverage: Complex Logic

**Date:** 2026-05-06  
**Scope:** Add meaningful tests for `NdJsonLineAccumulatorImpl` and `ConfigSchema`. No new production code — test files only.

---

## Targets

Two areas with real failure modes and low test coverage:

1. `NdJsonLineAccumulatorImpl` — 4-strategy JSON parsing fallback chain (no test file today)
2. `ConfigSchema` — Zod schema with `superRefine` duplicate-detection (31% branch coverage today)

---

## NdJsonLineAccumulator tests

**File:** `__tests__/features/NdJsonLineAccumulator.test.ts` (new)

**Setup:** `createTestContainer()` + `container.registerInstance(ParseNdJsonErrorHandler, ...)` to control error handler behavior before resolving. Same pattern as existing Upload tests.

**Table fixture:** `makeTable()` helper returning a minimal `Config.ResolvedTable`.

### Test cases

| # | Scenario | How to trigger | Expected |
|---|----------|----------------|----------|
| 1 | Line is self-contained valid JSON | `feed('{"pk":"a"}', table)` | Returns `{pk: "a"}`, no accumulation |
| 2 | Embedded newline in value (newline-join strategy) | `feed('{"msg": "hello', ...)` then `feed('world"}', ...)` | Second call returns `{msg: "hello\nworld"}` |
| 3 | Split number literal (empty-string-join strategy) | `feed('{"count": 1', ...)` then `feed('23}', ...)` | Newline-join produces invalid JSON; empty-string join produces `{count: 123}` |
| 4 | Fresh valid line after stale garbage | Accumulate invalid fragment, then `feed('{"fresh":1}', ...)` | Handler called once with garbage; returns `{fresh: 1}` |
| 5 | Line that completes no strategy | Accumulate partial, then feed another partial that can't complete any join | Returns null; pending grows |
| 6 | `flush()` with nothing pending | Call `flush()` on fresh accumulator | Returns null |
| 7 | `flush()` with pending content | Accumulate a fragment, then `flush()` | Handler called with accumulated content; returns handler's result |

**Error handler doubles:**
- Tests 1–5: handler that captures its calls (`{ handle: vi.fn().mockResolvedValue(null) }`)
- Tests 6–7: handler that returns a sentinel record to confirm it was invoked

---

## ConfigSchema tests

**File:** `__tests__/features/Config.test.ts` (extend existing `describe("Config", ...)`)

`ConfigSchema` is a pure Zod object — no DI involvement. Call `.safeParse()` directly.

### Test cases

| # | Scenario | Expected failure path |
|---|----------|-----------------------|
| 1 | Empty `tables` array | `tables: tables must be a non-empty array` |
| 2 | Two tables with the same `name` | `tables.1.name: duplicate of tables[0].name` |
| 3 | Two tables with the same `description` | `tables.1.description: duplicate of tables[0].description` |
| 4 | `description` longer than 40 characters | `description must be 40 characters or fewer` |
| 5 | `defaults` field missing entirely | Zod required-field error |
| 6 | Table omits `awsProfile`/`region` alongside valid `defaults` | Passes — merge is ConfigImpl's job, not the schema's |

**Helper:** `makeValidConfig()` — returns a minimal valid raw config object that each test can override one field on.

---

## What this does NOT cover

- `bootstrap.ts` / `cli.ts` — entry points, not unit-testable in isolation
- `Prompter` — interactive enquirer prompts, no practical unit-test path
- `Session` — deferred (simple key-value store, lower value than these two targets)
- `retryBackoffMs` / `isRetryableAwsError` — deferred (utilities, lower value)
