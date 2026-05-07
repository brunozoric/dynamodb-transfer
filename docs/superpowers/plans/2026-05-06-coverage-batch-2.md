# Coverage Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tests for `retryBackoffMs`, `isRetryableAwsError`, `readLoggerParamsFromEnv`, and `Session`, and fix `Session.snapshot()` to use `structuredClone`.

**Architecture:** Pure utility tests use direct imports and no container. The one DI class (`Session`) gets a minimal local container with only `SessionFeature` registered. The `structuredClone` fix lands before the Session tests so the tests verify the fixed behaviour.

**Tech Stack:** vitest, `@webiny/di` Container, TypeScript ESM with `~/` path alias.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/features/Session/Session.ts` |
| Create | `__tests__/base/retryBackoffMs.test.ts` |
| Create | `__tests__/base/isRetryableAwsError.test.ts` |
| Create | `__tests__/features/Logger.feature.test.ts` |
| Create | `__tests__/features/Session.test.ts` |

---

### Task 1: Fix `Session.snapshot()` — use `structuredClone`

**Files:**
- Modify: `src/features/Session/Session.ts:19`

- [ ] **Step 1: Apply the fix**

In `src/features/Session/Session.ts`, change the `snapshot` method body from:

```ts
    public snapshot(): Readonly<Partial<SessionAbstraction.Data>> {
        return { ...this.data };
    }
```

to:

```ts
    public snapshot(): Readonly<Partial<SessionAbstraction.Data>> {
        return structuredClone(this.data);
    }
```

- [ ] **Step 2: Type-check**

```bash
yarn ts-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/Session/Session.ts
git commit -m "fix: Session.snapshot() — deep clone with structuredClone instead of shallow spread"
```

---

### Task 2: `retryBackoffMs` tests

**Files:**
- Create: `__tests__/base/retryBackoffMs.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from "vitest";
import { retryBackoffMs } from "~/base/index.ts";

describe("retryBackoffMs", () => {
    it("attempt=0, initialMs=100: result is within [75, 125] and is an integer", () => {
        const result = retryBackoffMs(0, 100);
        expect(result).toBeGreaterThanOrEqual(75);
        expect(result).toBeLessThanOrEqual(125);
        expect(Number.isInteger(result)).toBe(true);
    });

    it("attempt=1, initialMs=100: result is within [150, 250]", () => {
        const result = retryBackoffMs(1, 100);
        expect(result).toBeGreaterThanOrEqual(150);
        expect(result).toBeLessThanOrEqual(250);
    });

    it("attempt=3, initialMs=50: result is within [300, 500]", () => {
        const result = retryBackoffMs(3, 50);
        expect(result).toBeGreaterThanOrEqual(300);
        expect(result).toBeLessThanOrEqual(500);
    });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/base/retryBackoffMs.test.ts
```

Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/base/retryBackoffMs.test.ts
git commit -m "test: retryBackoffMs — range assertions for attempt 0, 1, and 3"
```

---

### Task 3: `isRetryableAwsError` tests

**Files:**
- Create: `__tests__/base/isRetryableAwsError.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from "vitest";
import { isRetryableAwsError } from "~/base/index.ts";

describe("isRetryableAwsError", () => {
    it("returns true when error has no .code and error.name is a retryable code", () => {
        const error = new Error("provisioned throughput exceeded");
        error.name = "ProvisionedThroughputExceededException";
        expect(isRetryableAwsError(error)).toBe(true);
    });

    it("returns true when error message contains ECONNRESET", () => {
        expect(isRetryableAwsError(new Error("ECONNRESET"))).toBe(true);
    });

    it("returns true when error message contains ETIMEDOUT", () => {
        expect(isRetryableAwsError(new Error("connection ETIMEDOUT"))).toBe(true);
    });

    it("returns false for a non-Error value", () => {
        expect(isRetryableAwsError("ProvisionedThroughputExceededException")).toBe(false);
    });

    it("returns false for an unrelated Error", () => {
        expect(isRetryableAwsError(new Error("something unrelated"))).toBe(false);
    });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/base/isRetryableAwsError.test.ts
```

Expected: 5 passing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/base/isRetryableAwsError.test.ts
git commit -m "test: isRetryableAwsError — error.name fallback, ECONNRESET/ETIMEDOUT, non-Error input"
```

---

### Task 4: `readLoggerParamsFromEnv` tests

**Files:**
- Create: `__tests__/features/Logger.feature.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from "vitest";
import { readLoggerParamsFromEnv } from "~/features/Logger/feature.ts";

describe("readLoggerParamsFromEnv", () => {
    it('accepts log level "debug"', () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "debug" })).toEqual({
            logLevel: "debug",
            json: false
        });
    });

    it('accepts log level "info"', () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "info" })).toEqual({
            logLevel: "info",
            json: false
        });
    });

    it('accepts log level "warn"', () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "warn" })).toEqual({
            logLevel: "warn",
            json: false
        });
    });

    it('accepts log level "error"', () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "error" })).toEqual({
            logLevel: "error",
            json: false
        });
    });

    it('accepts log level "silent"', () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "silent" })).toEqual({
            logLevel: "silent",
            json: false
        });
    });

    it("falls back to info for an invalid LOG_LEVEL", () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "INVALID" })).toEqual({
            logLevel: "info",
            json: false
        });
    });

    it("falls back to info when LOG_LEVEL is absent", () => {
        expect(readLoggerParamsFromEnv({})).toEqual({ logLevel: "info", json: false });
    });

    it("sets json: true when LOG_FORMAT=json", () => {
        expect(readLoggerParamsFromEnv({ LOG_FORMAT: "json" })).toEqual({
            logLevel: "info",
            json: true
        });
    });

    it("combines a valid log level with LOG_FORMAT=json", () => {
        expect(readLoggerParamsFromEnv({ LOG_LEVEL: "debug", LOG_FORMAT: "json" })).toEqual({
            logLevel: "debug",
            json: true
        });
    });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/Logger.feature.test.ts
```

Expected: 9 passing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/features/Logger.feature.test.ts
git commit -m "test: readLoggerParamsFromEnv — all valid levels, invalid fallback, LOG_FORMAT=json"
```

---

### Task 5: `Session` tests

**Files:**
- Create: `__tests__/features/Session.test.ts`

`SessionImpl` is not exported — resolve `Session` through a container. `Session` has no dependencies so a minimal container with only `SessionFeature.register(container)` is sufficient; there is no need to use `createTestContainer`.

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from "vitest";
import { Container } from "@webiny/di";
import { Session, SessionFeature } from "~/features/Session/index.ts";
import type { Config } from "~/features/Config/index.ts";

function createSessionContainer(): Container {
    const container = new Container();
    SessionFeature.register(container);
    return container;
}

const sampleTable: Config.ResolvedTable = {
    name: "test-table",
    description: "Test table",
    writable: true,
    awsProfile: "test",
    region: "us-east-1"
};

describe("Session", () => {
    it("get on an unset key returns undefined", () => {
        const session = createSessionContainer().resolve(Session);
        expect(session.get("action")).toBeUndefined();
    });

    it("set then get roundtrip", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "download");
        expect(session.get("action")).toBe("download");
    });

    it("multiple keys are stored and retrieved independently", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "upload");
        session.set("segments", 4);
        expect(session.get("action")).toBe("upload");
        expect(session.get("segments")).toBe(4);
    });

    it("snapshot contains all set keys", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("action", "download");
        session.set("segments", 2);
        expect(session.snapshot()).toEqual({ action: "download", segments: 2 });
    });

    it("snapshot is a deep copy — mutating the returned object does not affect subsequent snapshots", () => {
        const session = createSessionContainer().resolve(Session);
        session.set("table", { ...sampleTable });
        const snap = session.snapshot();
        snap.table!.name = "mutated";
        expect(session.snapshot().table?.name).toBe("test-table");
    });

    it("snapshot on a fresh instance returns an empty object", () => {
        const session = createSessionContainer().resolve(Session);
        expect(session.snapshot()).toEqual({});
    });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/Session.test.ts
```

Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/features/Session.test.ts
git commit -m "test: Session — get/set roundtrip, multi-key, snapshot completeness and deep-copy"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full suite**

```bash
yarn ts-check && yarn format:check && yarn test
```

Expected: all checks pass, test count increases from 78 to ~96 (18 new tests across 4 new files).

- [ ] **Step 2: Confirm coverage improvement in output**

Look for statement and branch coverage increasing past the previous 65%/44% baseline in the vitest coverage report.
