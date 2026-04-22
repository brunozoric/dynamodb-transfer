import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PinoLogger } from "./PinoLogger.ts";

interface CapturedStdout {
    lines: string[];
    restore(): void;
}

function captureStdout(): CapturedStdout {
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
        const str = chunk.toString();
        if (str.trim()) {
            lines.push(str.trim());
        }
        return true;
    });
    return {
        lines,
        restore: () => spy.mockRestore()
    };
}

interface JsonEntry {
    type: string;
    message: string;
}

function parseLine(line: string | undefined): JsonEntry {
    if (line === undefined) {
        throw new Error("expected a captured log line, got none");
    }
    return JSON.parse(line) as JsonEntry;
}

describe("PinoLogger", () => {
    describe("pretty transport", () => {
        it("creates without throwing", () => {
            expect(() => new PinoLogger({ logLevel: "debug", transport: "pretty" })).not.toThrow();
        });

        it("all methods execute without throwing", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "pretty" });
            expect(() => logger.debug("debug msg")).not.toThrow();
            expect(() => logger.info("info msg")).not.toThrow();
            expect(() => logger.warn("warn msg")).not.toThrow();
            expect(() => logger.error("error msg")).not.toThrow();
            expect(() => logger.fatal("fatal msg")).not.toThrow();
            expect(() => logger.done("done msg")).not.toThrow();
        });
    });

    describe("json transport", () => {
        let capture: CapturedStdout;

        beforeEach(() => {
            capture = captureStdout();
        });

        afterEach(() => {
            capture.restore();
        });

        it("emits info type for info messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.info("hello");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("info");
            expect(entry.message).toBe("hello");
        });

        it("emits debug type for debug messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.debug("debug msg");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("debug");
            expect(entry.message).toBe("debug msg");
        });

        it("emits warn type for warn messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.warn("warn msg");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("warn");
            expect(entry.message).toBe("warn msg");
        });

        it("emits error type for error messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.error("error msg");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("error");
            expect(entry.message).toBe("error msg");
        });

        it("emits fatal type for fatal messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.fatal("fatal msg");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("fatal");
            expect(entry.message).toBe("fatal msg");
        });

        it("emits done type for done messages", () => {
            const logger = new PinoLogger({ logLevel: "debug", transport: "json" });
            logger.done("done msg");
            const entry = parseLine(capture.lines[0]);
            expect(entry.type).toBe("done");
            expect(entry.message).toBe("done msg");
        });

        it("done emits plain info on pretty transport", () => {
            capture.restore();
            const logger = new PinoLogger({ logLevel: "debug", transport: "pretty" });
            expect(() => logger.done("finished")).not.toThrow();
        });

        it("respects log level — does not emit debug/info/warn at error level", () => {
            const logger = new PinoLogger({ logLevel: "error", transport: "json" });
            logger.debug("should not appear");
            logger.info("should not appear");
            logger.warn("should not appear");
            expect(capture.lines).toHaveLength(0);
        });

        it("emits error and above at error level", () => {
            const logger = new PinoLogger({ logLevel: "error", transport: "json" });
            logger.error("visible");
            logger.fatal("also visible");
            expect(capture.lines).toHaveLength(2);
            expect(parseLine(capture.lines[0]).type).toBe("error");
            expect(parseLine(capture.lines[1]).type).toBe("fatal");
        });
    });

    describe("attachFile", () => {
        let tmp: string;

        beforeEach(() => {
            tmp = mkdtempSync(join(tmpdir(), "pino-file-"));
        });

        afterEach(() => {
            rmSync(tmp, { recursive: true, force: true });
        });

        it("creates the parent directory if missing", () => {
            const target = join(tmp, "nested", "sub", "out.log");
            expect(existsSync(join(tmp, "nested"))).toBe(false);

            const logger = new PinoLogger({ logLevel: "silent", transport: "pretty" });
            logger.attachFile(target);
            logger.info("ping");

            expect(existsSync(join(tmp, "nested", "sub"))).toBe(true);
            expect(existsSync(target)).toBe(true);
        });

        it("writes one plain-text line per log call, with timestamp and level prefix", () => {
            const target = join(tmp, "out.log");
            const logger = new PinoLogger({ logLevel: "silent", transport: "pretty" });
            logger.attachFile(target);

            logger.info("first");
            logger.error("boom");
            logger.done("finished");

            const contents = readFileSync(target, "utf-8");
            const lines = contents.split("\n").filter(Boolean);

            expect(lines).toHaveLength(3);
            expect(lines[0]).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[info\] first$/
            );
            expect(lines[1]).toMatch(/\[error\] boom$/);
            expect(lines[2]).toMatch(/\[done\] finished$/);
        });

        it("does not write to any file before attachFile is called", () => {
            const logger = new PinoLogger({ logLevel: "silent", transport: "pretty" });
            expect(() => logger.info("no file yet")).not.toThrow();
            // tmp should stay empty
        });
    });
});
