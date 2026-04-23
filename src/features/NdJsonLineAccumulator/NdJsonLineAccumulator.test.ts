import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Logger } from "~/features/Logger/index.ts";
import type { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { NdJsonLineAccumulatorImpl } from "./NdJsonLineAccumulator.ts";

const table: Config.ResolvedTable = {
    name: "test-table",
    description: "test",
    writable: false,
    awsProfile: "default",
    region: "us-east-1"
};

function makeLogger(): Logger.Interface {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        done: vi.fn(),
        attachFile: vi.fn()
    };
}

describe("NdJsonLineAccumulatorImpl", () => {
    let logger: Logger.Interface;
    let handleMock: ReturnType<typeof vi.fn>;
    let handler: ParseNdJsonErrorHandler.Interface;
    let accumulator: NdJsonLineAccumulatorImpl;

    beforeEach(() => {
        logger = makeLogger();
        handleMock = vi.fn().mockResolvedValue(null);
        handler = { handle: handleMock };
        accumulator = new NdJsonLineAccumulatorImpl(logger, handler);
    });

    describe("feed — no pending lines", () => {
        it("returns a parsed record when the line is valid JSON", async () => {
            const result = await accumulator.feed('{"pk":"user#1","sk":"profile"}', table);
            expect(result).toEqual({ pk: "user#1", sk: "profile" });
        });

        it("returns null and starts accumulating when the line is not valid JSON", async () => {
            const result = await accumulator.feed('{"pk":"user#1",', table);
            expect(result).toBeNull();
        });
    });

    describe("feed — with pending lines, newline join succeeds", () => {
        it("returns the combined record when pending + line joins with newline parse correctly", async () => {
            await accumulator.feed('{"pk":', table);
            const result = await accumulator.feed('"user#1"}', table);
            expect(result).toEqual({ pk: "user#1" });
        });

        it("clears pending after a successful newline-joined parse", async () => {
            await accumulator.feed('{"pk":', table);
            await accumulator.feed('"user#1"}', table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
        });
    });

    describe("feed — with pending lines, empty-string join succeeds", () => {
        it("returns the combined record when lines must be joined with empty string", async () => {
            // Literal newline inside a string value — newline join would produce invalid JSON
            await accumulator.feed('{"pk":"user#1","data":"val', table);
            const result = await accumulator.feed('ue"}', table);
            expect(result).toEqual({ pk: "user#1", data: "value" });
        });
    });

    describe("feed — with pending lines, current line succeeds alone", () => {
        it("discards pending, calls handler, and returns the standalone record", async () => {
            await accumulator.feed("{bad json", table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
            expect(handleMock).toHaveBeenCalledOnce();
        });

        it("passes the joined pending content to the handler as the line field", async () => {
            await accumulator.feed("line one", table);
            await accumulator.feed("line two", table);
            await accumulator.feed('{"pk":"user#3"}', table);
            const call = handleMock.mock.calls[0]![0] as Parameters<ParseNdJsonErrorHandler.Interface["handle"]>[0];
            expect(call.line).toBe("line one\nline two");
            expect(call.table).toBe(table);
        });

        it("clears pending after discard so subsequent lines start fresh", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.feed('{"pk":"user#1"}', table);
            const result = await accumulator.feed('{"pk":"user#2"}', table);
            expect(result).toEqual({ pk: "user#2" });
        });
    });

    describe("feed — with pending lines, all strategies fail", () => {
        it("keeps accumulating and returns null when no join strategy succeeds", async () => {
            await accumulator.feed('{"pk":', table);
            const result = await accumulator.feed('"sk":', table);
            expect(result).toBeNull();
            expect(handleMock).not.toHaveBeenCalled();
        });
    });

    describe("flush", () => {
        it("is a no-op when pending is empty", async () => {
            await accumulator.flush(table);
            expect(handleMock).not.toHaveBeenCalled();
        });

        it("calls handler with accumulated content when pending is non-empty", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.feed("json", table);
            await accumulator.flush(table);
            expect(handleMock).toHaveBeenCalledOnce();
            const call = handleMock.mock.calls[0]![0] as Parameters<ParseNdJsonErrorHandler.Interface["handle"]>[0];
            expect(call.line).toBe("{bad\njson");
            expect(call.table).toBe(table);
        });

        it("clears pending after flush", async () => {
            await accumulator.feed("{bad", table);
            await accumulator.flush(table);
            await accumulator.flush(table);
            expect(handleMock).toHaveBeenCalledOnce();
        });
    });
});
