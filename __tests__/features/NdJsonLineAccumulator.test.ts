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

  it("joins accumulated lines with a newline when that produces valid JSON", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    const first = await accumulator.feed('{"a": 1,', table);
    expect(first).toBeNull();
    const second = await accumulator.feed('"b": 2}', table);
    expect(second).toEqual({ a: 1, b: 2 });
  });

  it("falls back to empty-string join after the newline join fails to produce valid JSON", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    const first = await accumulator.feed('{"count": 1', table);
    expect(first).toBeNull();
    const second = await accumulator.feed("23}", table);
    expect(second).toEqual({ count: 123 });
  });

  it("discards accumulated garbage, calls the error handler, and returns the fresh line", async () => {
    const handleMock = vi.fn().mockResolvedValue(null);
    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, { handle: handleMock });
    const accumulator = container.resolve(NdJsonLineAccumulator);

    await accumulator.feed("[corrupt", table);
    const result = await accumulator.feed('{"fresh":true}', table);

    expect(handleMock).toHaveBeenCalledOnce();
    expect(handleMock).toHaveBeenCalledWith({
      table,
      line: "[corrupt",
      error: expect.any(Error)
    });
    expect(result).toEqual({ fresh: true });
  });

  it("returns null and keeps accumulating when no strategy produces valid JSON", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);

    const first = await accumulator.feed('{"key', table);
    expect(first).toBeNull();

    const second = await accumulator.feed('": "val', table);
    expect(second).toBeNull();
  });

  it("flush returns null when nothing is pending", async () => {
    const container = createTestContainer();
    const accumulator = container.resolve(NdJsonLineAccumulator);
    const result = await accumulator.flush(table);
    expect(result).toBeNull();
  });

  it("flush calls the error handler with accumulated content and returns its result", async () => {
    const sentinel = { pk: "flushed-record" };
    const handleMock = vi.fn().mockResolvedValue(sentinel);
    const container = createTestContainer();
    container.registerInstance(ParseNdJsonErrorHandler, { handle: handleMock });
    const accumulator = container.resolve(NdJsonLineAccumulator);

    await accumulator.feed('{"incomplete":', table);
    const result = await accumulator.flush(table);

    expect(handleMock).toHaveBeenCalledOnce();
    expect(handleMock).toHaveBeenCalledWith({
      table,
      line: '{"incomplete":',
      error: expect.any(Error)
    });
    expect(result).toBe(sentinel);
  });
});
