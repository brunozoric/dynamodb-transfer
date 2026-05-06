# Test Coverage Handoff — 2026-05-06

## Branch

`bruno/test/raise-coverage`

## What was done this session (batch 2)

- Fixed `Session.snapshot()` to use `structuredClone` instead of shallow spread (committed)
- Created `__tests__/base/retryBackoffMs.test.ts` — 3 range-assertion tests (committed)
- Created `__tests__/base/isRetryableAwsError.test.ts` — 5 gap tests: error.name fallback, ECONNRESET/ETIMEDOUT, non-Error, unrelated error (committed)
- Created `__tests__/features/Logger.feature.test.ts` — 9 tests for `readLoggerParamsFromEnv` (committed)
- Created `__tests__/features/Session.test.ts` — 6 tests using minimal container (committed)
- Coverage: 65% → 67.76% statements, 44% → 47.68% branches; 78 → 101 tests across 12 files
- All checks pass: `yarn ts-check`, `yarn format:check`, `yarn test`

## What was done this session (batch 3 — design only, no code yet)

- Brainstormed and designed batch 3 test targets
- Spec committed: `docs/superpowers/specs/2026-05-06-test-coverage-batch3-design.md`
- User approved adding `aws-sdk-client-mock` as a dev dependency — used in `DynamoDbClient.test.ts` only; dynalite-first rule still applies everywhere else
- AGENTS.md must be updated as part of batch 3 execution (see spec)

## What batch 3 executes (next session — skip brainstorming, go straight to writing-plans)

Design is approved. **Do not re-brainstorm.** Read the spec and invoke `superpowers:writing-plans` directly.

Spec: `docs/superpowers/specs/2026-05-06-test-coverage-batch3-design.md`

Summary of what the plan must cover:

### New file: `__tests__/features/DynamoDbClient.test.ts`

Instantiate `DynamoDbClientImpl` directly (not via DI container). Use `mockClient(DynamoDBDocumentClient)` from `aws-sdk-client-mock`. Inline no-op `Logger` and `WriteLogMapper` fakes.

| Test | Lines covered |
|------|--------------|
| `batchPut([])` returns without calling send | 57 |
| `scan` retries on throttle then yields items | 119–120 |
| `batchPut` retries on throttle then succeeds | 119–120 |
| `batchPut` escalates after max retries | 84–91, 124 |
| `batchPut` recurses on UnprocessedItems | 81–83 |

Set `tuning.maxRetries` to `1` or `2` in retry tests to keep wall-clock time fast.

### Append to `__tests__/features/Cli.test.ts`

| Test | Lines covered |
|------|--------------|
| download aborts when `destPath` is null | 51 |
| upload short-circuits when `sourceFile` is null | 67–68 |
| configureLogging attaches a log file when `logToFile` is true | 89–91 |

Test 3 (logToFile) needs a real dynalite table + tmp dest path to run the download to completion. Assert a log file was created at the path `paths.logFilePath({ tableName })` would produce.

### Append to `__tests__/features/Upload.test.ts`

| Test | Lines covered |
|------|--------------|
| skips blank lines in NDJSON | 103 |
| skips records when modifier returns null | 59–60, 114 |

Modifier test: `container.registerInstance(RecordModifier, { modify: async (opts) => opts.record.PK === "skip" ? null : opts.record })`.

### Also: update AGENTS.md

Remove the `No aws-sdk-client-mock` line. Replace with:

> **`aws-sdk-client-mock`** — used in `DynamoDbClient.test.ts` for paths that dynalite cannot simulate (retry sequences, UnprocessedItems, error escalation). All other test files use dynalite.

## What remains after batch 3

| File | Stmts | Notes |
|------|-------|-------|
| `src/features/Config/Config.ts` | 5.55% | Deferred — `importUserConfig()` requires `vi.doMock` + `vi.resetModules`. Dedicated batch. |
| `src/features/Download/Download.ts` | ~80% | Lines 110, 137, 144–153 are stream error/backpressure paths — brittle. Skipped by design. |
| `src/base/isRetryableAwsError.ts` | ~75% | `.code` direct path — low value, already exercised by integration tests. |

### Notes from batch 2 final review (still outstanding)

- `Logger.feature.test.ts` imports from `~/features/Logger/feature.ts` (internal file) rather than `~/features/Logger/index.ts` (public barrel). Cosmetic inconsistency with other tests.
- `Logger.feature.test.ts` file name breaks the `<FeatureName>.test.ts` convention. Could be `Logger.test.ts`.

### Approach

- Container-based where DI is involved; direct function calls / direct instantiation for pure utilities or when injecting mock infra
- `aws-sdk-client-mock` for DynamoDbClient retry/error paths; dynalite everywhere else
- Meaningful tests only — not coverage for coverage's sake
- `superpowers:verification-before-completion` before claiming done: `yarn ts-check && yarn format:check && yarn test`

## How to pick up

1. Read `AGENTS.md`
2. Read `docs/superpowers/specs/2026-05-06-test-coverage-batch3-design.md`
3. Invoke `superpowers:writing-plans` (design is already approved — skip brainstorming)
4. Proceed through `superpowers:subagent-driven-development`
