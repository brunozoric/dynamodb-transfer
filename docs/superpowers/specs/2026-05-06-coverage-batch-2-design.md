# Test Coverage Batch 2 — Design Spec

**Date:** 2026-05-06
**Branch:** `bruno/test/raise-coverage`

## Scope

Four targets: two pure base utilities, one pure feature function, one DI class. Plus one bug fix in `Session.snapshot()`.

## Fix: `Session.snapshot()` shallow copy

`src/features/Session/Session.ts` currently returns `{ ...this.data }` — a shallow spread. Replace with `structuredClone(this.data)` for a true deep copy. The new test (#5 below) will verify this.

---

## 1. `retryBackoffMs`

**File:** `__tests__/base/retryBackoffMs.test.ts`
**Import:** direct function call from `~/base/retryBackoffMs.ts`
**No container needed.**

Test strategy: range assertions (`toBeGreaterThanOrEqual` / `toBeLessThanOrEqual`). No `Math.random` mocking — tests real behavior.

| # | Inputs | Expected range | Extra assertion |
|---|--------|---------------|-----------------|
| 1 | `attempt=0, initialMs=100` | `[75, 125]` | result is integer |
| 2 | `attempt=1, initialMs=100` | `[150, 250]` | — |
| 3 | `attempt=3, initialMs=50` | `[300, 500]` | — |

---

## 2. `isRetryableAwsError`

**File:** `__tests__/base/isRetryableAwsError.test.ts`
**Import:** direct function call from `~/base/isRetryableAwsError.ts`
**No container needed.**

The `.code`-based happy path is already covered indirectly by integration tests. These tests cover the three untested gaps only.

| # | Input | Expected |
|---|-------|----------|
| 1 | `Error` with no `.code`, `name = "ProvisionedThroughputExceededException"` | `true` |
| 2 | `new Error("ECONNRESET")` | `true` |
| 3 | `new Error("connection ETIMEDOUT")` | `true` |
| 4 | Plain string `"ProvisionedThroughputExceededException"` | `false` |
| 5 | `new Error("something unrelated")` | `false` |

---

## 3. `readLoggerParamsFromEnv`

**File:** `__tests__/features/Logger.feature.test.ts`
**Import:** `readLoggerParamsFromEnv` from `~/features/Logger/feature.ts`
**No container needed.**

| # | `LOG_LEVEL` | `LOG_FORMAT` | Expected `logLevel` | Expected `json` |
|---|-------------|-------------|---------------------|-----------------|
| 1 | `"debug"` | absent | `"debug"` | `false` |
| 2 | `"info"` | absent | `"info"` | `false` |
| 3 | `"warn"` | absent | `"warn"` | `false` |
| 4 | `"error"` | absent | `"error"` | `false` |
| 5 | `"silent"` | absent | `"silent"` | `false` |
| 6 | `"INVALID"` | absent | `"info"` | `false` |
| 7 | absent | absent | `"info"` | `false` |
| 8 | absent | `"json"` | `"info"` | `true` |
| 9 | `"debug"` | `"json"` | `"debug"` | `true` |

---

## 4. `Session`

**File:** `__tests__/features/Session.test.ts`
**Uses:** `createTestContainer()` + `container.resolve(Session)`

| # | Description |
|---|-------------|
| 1 | `get` on unset key → `undefined` |
| 2 | `set` then `get` roundtrip — `action: "download"` readable back |
| 3 | `set` multiple keys, each `get` returns correct value |
| 4 | `snapshot` contains all set keys |
| 5 | `snapshot` is a deep copy — set `table` key (a nested object), get snapshot, mutate a property on the returned `table` object, call `snapshot()` again, assert the property is unchanged |
| 6 | `snapshot` on fresh instance → `{}` |
