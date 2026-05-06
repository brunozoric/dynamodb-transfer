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

## What remains (next session goal: push coverage higher)

Lower-coverage files not yet touched, in priority order:

| File | Stmts | What to test |
|------|-------|--------------|
| `src/features/Config/Config.ts` | 5.55% | `load()` behavior — needs real DynamoDB (dynalite); consider whether there's a meaningful unit slice |
| `src/features/DynamoDbClient/DynamoDbClient.ts` | 78.57% | Lines 57, 81–91, 119–124 — retry path, error escalation |
| `src/features/Download/Download.ts` | 80.24% | Lines 110, 137, 144–153 — segment concat path, error cases |
| `src/features/Upload/Upload.ts` | 86.11% | Lines 59–60, 103, 114 — resume-from-line and error paths |
| `src/features/Cli/Cli.ts` | 87.23% | Lines 51, 67–68, 89–91 — exit path, edge interactions |
| `src/base/isRetryableAwsError.ts` | ~75% | `.code` direct path still uncovered (low value — already exercised by DDB integration tests) |

### Notes from batch 2 final review

- `Logger.feature.test.ts` imports from `~/features/Logger/feature.ts` (internal file) rather than `~/features/Logger/index.ts` (public barrel). Cosmetic inconsistency with other tests. Could rename in a cleanup pass.
- `Logger.feature.test.ts` file name breaks the `<FeatureName>.test.ts` convention. Could be `Logger.test.ts`.

### Approach agreed in previous sessions

- Container-based where DI is involved; direct function calls for pure utilities
- Meaningful tests only — not coverage for coverage's sake
- Follow brainstorm → spec → plan → execute flow with approvals at each gate

## How to pick up

1. Read `AGENTS.md`
2. Invoke `superpowers:brainstorming` to design the next batch of tests
3. Proceed through `superpowers:writing-plans` → `superpowers:subagent-driven-development`
