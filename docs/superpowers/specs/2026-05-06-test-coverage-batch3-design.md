# Test Coverage — Batch 3 Design

**Date:** 2026-05-06  
**Branch:** `bruno/test/raise-coverage`  
**Baseline:** 67.76% stmts, 47.68% branches, 101 tests / 12 files

## Scope

Three test files touched. Config.ts and Download.ts stream-error paths explicitly excluded (see Exclusions).

## New dependency: aws-sdk-client-mock

`aws-sdk-client-mock` is added as a dev dependency and used in `DynamoDbClient.test.ts` for paths that dynalite cannot simulate (retry sequences, UnprocessedItems, error escalation). The dynalite-first rule continues to apply everywhere else. AGENTS.md is updated to reflect the new convention.

## 1. `__tests__/features/DynamoDbClient.test.ts` (new file)

`DynamoDbClientImpl` is instantiated directly (not via DI container) with:
- `mockClient(DynamoDBDocumentClient)` from `aws-sdk-client-mock`
- Inline no-op `Logger` fake
- Inline `WriteLogMapper` fake that returns `null`

`tuning.maxRetries` is set to `1` or `2` in tests that exercise the retry loop, keeping wall-clock time negligible.

| # | Test name | Mock setup | Lines covered |
|---|-----------|-----------|---------------|
| 1 | `batchPut with empty array returns without sending` | none | 57 |
| 2 | `scan retries on throttle then yields items` | send: throws `ProvisionedThroughputExceededException` once, then resolves with items | 119–120 |
| 3 | `batchPut retries on throttle then succeeds` | send: throws `ProvisionedThroughputExceededException` once, then resolves | 119–120 (batchPut path) |
| 4 | `batchPut escalates error after max retries` | send: always throws retryable error | 84–91, 124 |
| 5 | `batchPut recurses on UnprocessedItems` | first send response contains `UnprocessedItems`; second is clean | 81–83 |

## 2. `__tests__/features/Cli.test.ts` (append to existing `describe("Cli")`)

All three use the scripted prompter pattern already in the file.

| # | Test name | Prompter script | Lines covered |
|---|-----------|----------------|---------------|
| 6 | `aborts download when destPath is null` | `action→"download"`, `destPath→null` | 51 |
| 7 | `short-circuits upload when sourceFile is null` | `action→"upload"`, `sourceFile→null` | 67–68 |
| 8 | `attaches log file when logToFile is true` | full download flow, `logToFile→true` | 89–91 |

Test 8 requires a dynalite table and a dest tmp path (to run the download to completion). It asserts a log file exists at the path that `paths.logFilePath()` would produce for that table name.

## 3. `__tests__/features/Upload.test.ts` (append to existing `describe("Upload")`)

Both use the container + dynalite pattern already in the file.

| # | Test name | Setup | Lines covered |
|---|-----------|-------|---------------|
| 9 | `skips blank lines in NDJSON` | source file has blank lines between valid records; asserts only non-blank records in DDB | 103 |
| 10 | `skips records when modifier returns null` | `container.registerInstance(RecordModifier, { modify: async (opts) => opts.record.PK === "skip" ? null : opts.record })`; asserts "skip" record absent from DDB | 59–60, 114 |

## Exclusions

- **Config.ts** (5.55%): `importUserConfig()` dynamic import requires `vi.doMock` + `vi.resetModules`. Deferred to a dedicated batch.
- **Download.ts lines 110, 137, 144–153**: OS-level stream error / backpressure paths. Hard to trigger reliably; tests would be brittle.

## Expected outcome

~10 new tests. Estimated gains: +3–4% statements, +4–6% branches (retry/unprocessed-items paths are branch-heavy).

## AGENTS.md change

Remove the `No aws-sdk-client-mock` prohibition. Replace with:

> **`aws-sdk-client-mock`** — used in `DynamoDbClient.test.ts` for paths that dynalite cannot simulate (retry sequences, UnprocessedItems, error escalation). All other test files use dynalite.
