# Test Coverage: Complex Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 13 meaningful tests covering `NdJsonLineAccumulatorImpl`'s 4-strategy fallback chain and `ConfigSchema`'s Zod validation rules.

**Architecture:** Two test files — one new (`NdJsonLineAccumulator.test.ts`) using the container pattern established by Upload tests, and additions to the existing `Config.test.ts` calling `ConfigSchema.safeParse()` directly (the schema is a pure Zod object with no DI involvement).

**Tech Stack:** vitest, `@webiny/di` Container, existing `createTestContainer` helper, `vi.fn()` for error handler doubles.

---

## File map

| Action | File |
|--------|------|
| Create | `__tests__/features/NdJsonLineAccumulator.test.ts` |
| Modify | `__tests__/features/Config.test.ts` |

---

### Task 1: NdJsonLineAccumulator — strategy 1 (direct parse)

**Files:**
- Create: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Create the test file with the first test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { NdJsonLineAccumulator } from "~/features/NdJsonLineAccumulator/index.ts";
import { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";

const table: Config.ResolvedTable = {
    name: "test-table",
    description: "Test",
    writable: true,
    awsProfile: "test",
    region: "us-east-1"
};

describe("NdJsonLineAccumulator", () => {
    it("returns a record immediately when the line is self-contained valid JSON", async () => {
        const container = createTestContainer();
        const accumulator = container.resolve(NdJsonLineAccumulator);
        const result = await accumulator.feed('{"pk":"a","sk":"b"}', table);
        expect(result).toEqual({ pk: "a", sk: "b" });
    });
});
```

- [ ] **Step 2: Run the test**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 1 passed

---

### Task 2: NdJsonLineAccumulator — strategy 2 (newline join)

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the newline-join test inside `describe("NdJsonLineAccumulator", ...)`**

```typescript
it("joins accumulated lines with a newline when that produces valid JSON", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    // Line 1 opens a string value containing an embedded newline — fails to parse alone
    const first = await accumulator.feed('{"msg": "hello', table);
    expect(first).toBeNull();
    // Line 2 closes the string; newline-join yields {"msg": "hello\nworld"}
    const second = await accumulator.feed('world"}', table);
    expect(second).toEqual({ msg: "hello\nworld" });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 2 passed

---

### Task 3: NdJsonLineAccumulator — strategy 3 (empty-string join)

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the empty-string-join test**

```typescript
it("joins accumulated lines with an empty string when the newline join would be invalid", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    // Line 1: partial number — fails alone
    const first = await accumulator.feed('{"count": 1', table);
    expect(first).toBeNull();
    // Newline-join: {"count": 1\n23} — two values, invalid JSON
    // Empty-string join: {"count": 123} — valid
    const second = await accumulator.feed('23}', table);
    expect(second).toEqual({ count: 123 });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 3 passed

---

### Task 4: NdJsonLineAccumulator — strategy 4 (discard accumulated, line alone parses)

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the discard-and-return test**

```typescript
it("discards accumulated garbage, calls the error handler, and returns the fresh line", async () => {
    const handleMock = vi.fn().mockResolvedValue(null);
    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, { handle: handleMock });
    const accumulator = container.resolve(NdJsonLineAccumulator);

    // "[corrupt" fails all joins with the next line, but the next line alone is valid
    await accumulator.feed("[corrupt", table);
    const result = await accumulator.feed('{"fresh":true}', table);

    expect(handleMock).toHaveBeenCalledOnce();
    // The fresh line is returned after the garbage is discarded
    expect(result).toEqual({ fresh: true });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 4 passed

---

### Task 5: NdJsonLineAccumulator — strategy 5 (all fail, keep accumulating)

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the continue-accumulating test**

```typescript
it("returns null and keeps accumulating when no strategy produces valid JSON", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);

    // '{"key' fails alone → starts accumulating
    const first = await accumulator.feed('{"key', table);
    expect(first).toBeNull();

    // '": "val' — all three joins fail:
    //   newline: {"key\n": "val  (unclosed string, no closing brace)
    //   empty:   {"key": "val   (unclosed string, no closing brace)
    //   alone:   ": "val        (not valid JSON)
    const second = await accumulator.feed('": "val', table);
    expect(second).toBeNull();
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 5 passed

---

### Task 6: NdJsonLineAccumulator — flush with nothing pending

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the flush-empty test**

```typescript
it("flush returns null when nothing is pending", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    const result = await accumulator.flush(table);
    expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 6 passed

---

### Task 7: NdJsonLineAccumulator — flush with pending content

**Files:**
- Modify: `__tests__/features/NdJsonLineAccumulator.test.ts`

- [ ] **Step 1: Add the flush-with-pending test**

```typescript
it("flush calls the error handler with accumulated content and returns its result", async () => {
    const sentinel = { pk: "flushed-record" };
    const handleMock = vi.fn().mockResolvedValue(sentinel);
    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, { handle: handleMock });
    const accumulator = container.resolve(NdJsonLineAccumulator);

    await accumulator.feed('{"incomplete":', table);
    const result = await accumulator.flush(table);

    expect(handleMock).toHaveBeenCalledOnce();
    expect(result).toBe(sentinel);
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test __tests__/features/NdJsonLineAccumulator.test.ts
```

Expected: 7 passed

- [ ] **Step 3: Commit**

```bash
git add __tests__/features/NdJsonLineAccumulator.test.ts
git commit -m "test: NdJsonLineAccumulator — all four accumulation strategies and flush"
```

---

### Task 8: ConfigSchema — empty tables and missing defaults

**Files:**
- Modify: `__tests__/features/Config.test.ts`

- [ ] **Step 1: Add a `makeValidRawConfig` helper and a new describe block at the bottom of the file**

Add this import at the top of the file (alongside the existing Config imports):
```typescript
import { ConfigSchema } from "~/features/Config/index.ts";
```

Add this at the bottom of the file (after the existing `describe("Config", ...)` block closes):

```typescript
function makeValidRawConfig() {
    return {
        defaults: { awsProfile: "dev", region: "us-east-1" },
        tables: [{ name: "my-table", description: "Main table", writable: true }]
    };
}

describe("ConfigSchema", () => {
    it("fails when tables array is empty", () => {
        const result = ConfigSchema.safeParse({ ...makeValidRawConfig(), tables: [] });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe("tables must be a non-empty array");
        }
    });

    it("fails when the defaults field is missing", () => {
        const { defaults: _defaults, ...config } = makeValidRawConfig();
        const result = ConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });
});
```

- [ ] **Step 2: Run the Config tests**

```bash
yarn test __tests__/features/Config.test.ts
```

Expected: all existing tests + 2 new = pass

---

### Task 9: ConfigSchema — duplicate name and description

**Files:**
- Modify: `__tests__/features/Config.test.ts`

- [ ] **Step 1: Add duplicate-detection tests inside `describe("ConfigSchema", ...)`**

```typescript
it("fails when two tables share the same name", () => {
    const config = {
        ...makeValidRawConfig(),
        tables: [
            { name: "dup", description: "First table", writable: true },
            { name: "dup", description: "Second table", writable: true }
        ]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toBe("duplicate of tables[0].name");
        expect(issue?.path).toEqual(["tables", 1, "name"]);
    }
});

it("fails when two tables share the same description", () => {
    const config = {
        ...makeValidRawConfig(),
        tables: [
            { name: "table-a", description: "Shared desc", writable: true },
            { name: "table-b", description: "Shared desc", writable: true }
        ]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.message).toBe("duplicate of tables[0].description");
        expect(issue?.path).toEqual(["tables", 1, "description"]);
    }
});
```

- [ ] **Step 2: Run the Config tests**

```bash
yarn test __tests__/features/Config.test.ts
```

Expected: all pass

---

### Task 10: ConfigSchema — description length and optional fields

**Files:**
- Modify: `__tests__/features/Config.test.ts`

- [ ] **Step 1: Add the remaining schema tests inside `describe("ConfigSchema", ...)`**

```typescript
it("fails when a description exceeds 40 characters", () => {
    const config = {
        ...makeValidRawConfig(),
        tables: [{ name: "my-table", description: "A".repeat(41), writable: true }]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("description must be 40 characters or fewer");
    }
});

it("passes when a table omits awsProfile and region (schema does not require them)", () => {
    const config = {
        defaults: { awsProfile: "dev", region: "us-east-1" },
        tables: [{ name: "my-table", description: "Main table", writable: true }]
    };
    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run all tests**

```bash
yarn test
```

Expected: 7 files, 78 passed (65 existing + 13 new)

- [ ] **Step 3: Commit**

```bash
git add __tests__/features/Config.test.ts
git commit -m "test: ConfigSchema — empty tables, missing defaults, duplicate names/descriptions, description length"
```
