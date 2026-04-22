import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container } from "@webiny/di";
import { Paths, PathsFeature } from "~/features/Paths/index.ts";

function resolvePaths(): Paths.Interface {
  const container = new Container();
  PathsFeature.register(container);
  return container.resolve(Paths);
}

describe("Paths", () => {
  describe("dataFilePath", () => {
    it("camelCases description and appends ndjson extension", () => {
      const paths = resolvePaths();
      expect(
        paths.dataFilePath({
          description: "My Production Table",
          format: "ndjson"
        })
      ).toBe(join("data", "myProductionTable.ndjson"));
    });

    it("uses the json extension when format is json", () => {
      const paths = resolvePaths();
      expect(paths.dataFilePath({ description: "Staging", format: "json" })).toBe(
        join("data", "staging.json")
      );
    });

    it("treats any non-alphanumeric run as a word boundary", () => {
      const paths = resolvePaths();
      expect(
        paths.dataFilePath({
          description: "users_v2-archive",
          format: "ndjson"
        })
      ).toBe(join("data", "usersV2Archive.ndjson"));
    });

    it("returns the original description unchanged when it has no alphanumerics", () => {
      const paths = resolvePaths();
      expect(paths.dataFilePath({ description: "---", format: "json" })).toBe(
        join("data", "---.json")
      );
    });
  });

  describe("extensionFor", () => {
    it("returns .ndjson for ndjson format", () => {
      expect(resolvePaths().extensionFor("ndjson")).toBe(".ndjson");
    });

    it("returns .json for json format", () => {
      expect(resolvePaths().extensionFor("json")).toBe(".json");
    });
  });

  describe("detectFormat", () => {
    it("returns ndjson for .ndjson files", () => {
      expect(resolvePaths().detectFormat("data/foo.ndjson")).toBe("ndjson");
    });

    it("returns json for .json files", () => {
      expect(resolvePaths().detectFormat("data/foo.json")).toBe("json");
    });

    it("does not confuse .ndjson with .json (the n in ndjson is not eaten by a .json suffix match)", () => {
      expect(resolvePaths().detectFormat("weird.ndjson")).toBe("ndjson");
    });

    it("returns null for unknown extensions", () => {
      expect(resolvePaths().detectFormat("foo.txt")).toBeNull();
      expect(resolvePaths().detectFormat("foo")).toBeNull();
    });
  });

  describe("logFilePath", () => {
    it("builds .log/<camelCase>-<unixTs>.log with the current timestamp", () => {
      const before = Math.floor(Date.now() / 1000);
      const result = resolvePaths().logFilePath({ tableName: "my-prod-users" });
      const after = Math.floor(Date.now() / 1000);

      const match = result.match(/^(.+?)[/\\]myProdUsers-(\d+)\.log$/);
      expect(match).not.toBeNull();
      const prefix = match![1]!;
      const ts = Number(match![2]);
      expect(prefix).toBe(".log");
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("camelCases the raw table name before inserting it", () => {
      const result = resolvePaths().logFilePath({ tableName: "order-events-v2" });
      expect(result).toMatch(/orderEventsV2-\d+\.log$/);
    });
  });

  describe("inDataDir", () => {
    it("joins the data dir with the given basename", () => {
      expect(resolvePaths().inDataDir("file.ndjson")).toBe(join("data", "file.ndjson"));
    });
  });

  describe("listDataFiles", () => {
    let tmp: string;
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();
      tmp = mkdtempSync(join(tmpdir(), "paths-test-"));
      process.chdir(tmp);
    });

    afterEach(() => {
      process.chdir(originalCwd);
      rmSync(tmp, { recursive: true, force: true });
    });

    it("returns an empty array when the data directory does not exist", () => {
      expect(resolvePaths().listDataFiles()).toEqual([]);
    });

    it("returns .json and .ndjson files as full paths, filters others, sorts alphabetically", () => {
      mkdirSync("data");
      writeFileSync(join("data", "z-table.ndjson"), "");
      writeFileSync(join("data", "a-table.json"), "");
      writeFileSync(join("data", "readme.txt"), "");
      writeFileSync(join("data", "m-table.ndjson"), "");

      const result = resolvePaths().listDataFiles();

      expect(result).toEqual([
        join("data", "a-table.json"),
        join("data", "m-table.ndjson"),
        join("data", "z-table.ndjson")
      ]);
    });

    it("returns an empty array when the data directory exists but holds no matching files", () => {
      mkdirSync("data");
      writeFileSync(join("data", "readme.md"), "");

      expect(resolvePaths().listDataFiles()).toEqual([]);
    });
  });
});
