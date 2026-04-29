import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Download } from "~/features/Download/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";
import { createTestTable, dropTestTable, putTestItems } from "../helpers/dynaliteTables.ts";

const makeTable = (name: string): Config.ResolvedTable => ({
  name,
  description: "Test table",
  writable: true,
  awsProfile: "test",
  region: "us-east-1"
});

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ddbx-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Download", () => {
  const tablesToClean: string[] = [];
  const dirsToClean: string[] = [];

  afterEach(async () => {
    while (tablesToClean.length > 0) {
      const name = tablesToClean.pop();
      if (name !== undefined) {
        await dropTestTable(name);
      }
    }
    while (dirsToClean.length > 0) {
      const dir = dirsToClean.pop();
      if (dir !== undefined) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("writes NDJSON line-per-item with 1 segment", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    await putTestItems(tableName, [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 },
      { PK: "c", value: 3 }
    ]);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.ndjson");

    const container = createTestContainer();
    const download = container.resolve(Download);
    await download.run({
      table: makeTable(tableName),
      destPath,
      format: "ndjson",
      segments: 1
    });

    const contents = readFileSync(destPath, "utf-8");
    const lines = contents.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
    const parsed = lines.map(l => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.map(p => p.PK).sort()).toEqual(["a", "b", "c"]);
  });

  it("writes NDJSON with multiple segments and captures every item", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const items = Array.from({ length: 50 }, (_, i) => ({
      PK: `k${i}`,
      value: i
    }));
    await putTestItems(tableName, items);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.ndjson");

    const container = createTestContainer();
    const download = container.resolve(Download);
    await download.run({
      table: makeTable(tableName),
      destPath,
      format: "ndjson",
      segments: 4
    });

    const lines = readFileSync(destPath, "utf-8").split("\n").filter(Boolean);
    expect(lines).toHaveLength(50);
    const keys = lines.map(l => (JSON.parse(l) as { PK: string }).PK);
    expect(new Set(keys).size).toBe(50);
  });

  it("writes pretty-printed JSON array with 1 segment", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    await putTestItems(tableName, [{ PK: "a", value: 1 }]);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.json");

    const container = createTestContainer();
    const download = container.resolve(Download);
    await download.run({
      table: makeTable(tableName),
      destPath,
      format: "json",
      segments: 1
    });

    const parsed = JSON.parse(readFileSync(destPath, "utf-8")) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.PK).toBe("a");
  });

  it("escapes embedded newlines and Unicode line separators so each item occupies exactly one NDJSON line", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    await putTestItems(tableName, [
      { PK: "lf",   body: "before\nafter" },
      { PK: "crlf", body: "before\r\nafter" },
      { PK: "ls",   body: "before after" },
      { PK: "ps",   body: "before after" }
    ]);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.ndjson");

    const container = createTestContainer();
    const download = container.resolve(Download);
    await download.run({ table: makeTable(tableName), destPath, format: "ndjson", segments: 1 });

    const contents = readFileSync(destPath, "utf-8");
    const lines = contents.split("\n").filter(Boolean);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      // \r must be escaped by JSON.stringify; U+2028/U+2029 are valid JSON string
      // characters and intentionally left unescaped — readline does not split on
      // them so they do not break NDJSON line boundaries.
      expect(line).not.toContain("\r");
      expect(() => JSON.parse(line)).not.toThrow();
    }
    const parsed = lines.map(l => JSON.parse(l) as Record<string, string>);
    const byPk = Object.fromEntries(parsed.map(p => [p["PK"] as string, p["body"] as string]));
    expect(byPk["lf"]).toBe("before\nafter");
    expect(byPk["crlf"]).toBe("before\r\nafter");
    expect(byPk["ls"]).toBe("before after");
    expect(byPk["ps"]).toBe("before after");
  });

  it("wraps errors with 'Download failed:' prefix", async () => {
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.ndjson");

    const container = createTestContainer();
    const download = container.resolve(Download);
    await expect(
      download.run({
        table: makeTable("does-not-exist-table"),
        destPath,
        format: "ndjson",
        segments: 1
      })
    ).rejects.toThrowError(/^Download failed:/);
  });
});
