# NdJsonLineAccumulator Design

**Date:** 2026-04-23  
**Branch:** bruno/feat/continue-from-line  
**Status:** Approved

## Problem

Some NDJSON files contain records that span 2–3 lines (e.g. pretty-printed JSON). The current `Upload.ts` loop reads one line at a time and passes failures directly to `ParseNdJsonErrorHandler`, which either skips or throws. There is no mechanism to accumulate partial lines and retry them as a combined record.

## Solution

Introduce a new `NdJsonLineAccumulator` feature that sits between the readline loop and the JSON parsing logic. Every line passes through it. It owns the accumulation state and returns a parsed record or `null`. `Upload.ts` no longer calls `ParseNdJsonErrorHandler` directly.

## Architecture

```
Upload
  └─ NdJsonLineAccumulator   (new)
       ├─ ParseNdJsonErrorHandler  (existing, unchanged interface)
       └─ Logger                   (existing)
```

New feature lives at: `src/features/NdJsonLineAccumulator/`  
Structure mirrors existing features: `abstractions/`, `NdJsonLineAccumulator.ts`, `feature.ts`, `index.ts`.

## Interface

```typescript
interface INdJsonLineAccumulator {
    feed(line: string, table: Config.ResolvedTable): Promise<Record<string, unknown> | null>;
    flush(table: Config.ResolvedTable): Promise<void>;
}
```

- `feed()` — called for every non-empty line. Returns a parsed record or `null`.
- `flush()` — called once after the readline loop ends. Discards any remaining pending lines via `ParseNdJsonErrorHandler`.

## Data Flow

### `feed(line, table)`

**When `pending` is empty:**

1. Try `JSON.parse(line)`
   - Success → return record
   - Fail → push `line` to `pending`, return `null`

**When `pending` is not empty:**

1. Try `JSON.parse([...pending, line].join("\n"))`
   - Success → clear `pending`, return record
2. Try `JSON.parse([...pending, line].join(""))`
   - Success → clear `pending`, return record
3. Try `JSON.parse(line)` alone
   - Success → call `handler.handle({ table, line: pending.join("\n"), error })` for discard notification, clear `pending`, return record
   - Fail → push `line` to `pending`, return `null`

The two join strategies cover both pretty-printed splits (`"\n"`) and token-boundary splits (`""`).

### `flush(table)`

If `pending` is non-empty at end of stream:

1. Call `handler.handle({ table, line: pending.join("\n"), error: new Error("Unexpected end of file while accumulating lines") })`
2. Clear `pending`

## State Management

The accumulator is registered as a singleton in the DI container. It holds `pending: string[]` as mutable internal state.

Since `sendNdjson` is called once per file and `flush()` is always called at the end of the loop, there is no cross-file state contamination. No `reset()` method is needed — `flush()` leaves the accumulator clean.

## Upload.ts Changes

`Upload.ts` replaces its `ParseNdJsonErrorHandler` dependency with `NdJsonLineAccumulator`. The `sendNdjson` loop becomes:

```typescript
for await (const line of rl) {
    if (line.trim().length === 0) {
        continue;
    }
    if (lineIndex++ < startFrom) {
        continue;
    }
    const parsed = await this.accumulator.feed(line, table);
    if (parsed === null) {
        continue;
    }
    buffer.push(parsed);
    // ...rest unchanged
}
await this.accumulator.flush(table);
```

The `getParsed()` private method is removed — its logic now lives inside `NdJsonLineAccumulator`.

## Extension Point

`NdJsonLineAccumulator` is a DI abstraction, so callers can override the whole accumulator. The default implementation uses `ParseNdJsonErrorHandler` for discard decisions. `ParseNdJsonErrorHandler` itself remains unchanged — it still decides "log and skip" vs "throw" when given unresolvable content.

## Files to Create

- `src/features/NdJsonLineAccumulator/abstractions/NdJsonLineAccumulator.ts`
- `src/features/NdJsonLineAccumulator/abstractions/index.ts`
- `src/features/NdJsonLineAccumulator/NdJsonLineAccumulator.ts`
- `src/features/NdJsonLineAccumulator/feature.ts`
- `src/features/NdJsonLineAccumulator/index.ts`

## Files to Modify

- `src/features/Upload/Upload.ts` — swap dependency, remove `getParsed()`, call `flush()`
- `src/bootstrap.ts` — register `NdJsonLineAccumulatorFeature`
- `src/index.ts` — export new feature if needed
