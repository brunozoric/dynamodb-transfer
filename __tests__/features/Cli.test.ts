import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Cli } from "~/features/Cli/index.ts";
import { Prompter } from "~/features/Prompter/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";
import { createScriptedPrompter } from "../helpers/scriptedPrompter.ts";
import {
  createTestTable,
  dropTestTable,
  putTestItems,
  scanAllItems
} from "../helpers/dynaliteTables.ts";

function makeWritableTable(name: string): Config.ResolvedTable {
  return {
    name,
    description: "Test",
    writable: true,
    awsProfile: "test",
    region: "us-east-1"
  };
}

function makeTmpDir(): string {
  const dir = join(tmpdir(), `ddbx-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Cli", () => {
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

  it("runs the full download flow end to end", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    await putTestItems(tableName, [
      { PK: "a", v: 1 },
      { PK: "b", v: 2 }
    ]);

    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const destPath = join(dir, "out.ndjson");

    const tables = [makeWritableTable(tableName)];
    const container = createTestContainer({ tables });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "download",
        table: async ({ tables: ts }) => ts[0]!,
        segments: async () => 1,
        downloadFormat: async () => "ndjson",
        destPath: async () => destPath,
        logToFile: async () => false
      })
    );

    const cli = container.resolve(Cli);
    await cli.run();

    const lines = readFileSync(destPath, "utf-8").split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    const keys = lines.map(l => (JSON.parse(l) as { PK: string }).PK).sort();
    expect(keys).toEqual(["a", "b"]);
  });

  it("runs the full upload flow end to end", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);

    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    writeFileSync(
      sourcePath,
      [JSON.stringify({ PK: "x", v: 1 }), JSON.stringify({ PK: "y", v: 2 })].join("\n") + "\n"
    );

    const tables = [makeWritableTable(tableName)];
    const container = createTestContainer({ tables });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "upload",
        sourceFile: async () => sourcePath,
        table: async ({ tables: ts }) => ts[0]!,
        startFrom: async () => 0,
        confirmUpload: async () => {
          // accept: no-op
        },
        logToFile: async () => false
      })
    );

    const cli = container.resolve(Cli);
    await cli.run();

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["x", "y"]);
  });

  it("returns cleanly on the exit action without touching any other prompter method", async () => {
    const container = createTestContainer({ tables: [] });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "exit"
      })
    );

    const cli = container.resolve(Cli);
    await expect(cli.run()).resolves.toBeUndefined();
  });

  it("short-circuits upload when config has no writable tables", async () => {
    const tables: Config.ResolvedTable[] = [
      {
        name: "readonly-table",
        description: "ReadOnly",
        writable: false,
        awsProfile: "test",
        region: "us-east-1"
      }
    ];
    const container = createTestContainer({ tables });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "upload"
        // No sourceFile/table/confirmUpload scripted — early return means they must not be called.
      })
    );

    const cli = container.resolve(Cli);
    await expect(cli.run()).resolves.toBeUndefined();
  });

  it("skips items before startFrom in the upload flow", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);

    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    writeFileSync(
      sourcePath,
      [JSON.stringify({ PK: "skip", v: 0 }), JSON.stringify({ PK: "keep", v: 1 })].join("\n") + "\n"
    );

    const tables = [makeWritableTable(tableName)];
    const container = createTestContainer({ tables });

    container.registerInstance(
      Prompter,
      createScriptedPrompter({
        action: async () => "upload",
        sourceFile: async () => sourcePath,
        table: async ({ tables: ts }) => ts[0]!,
        startFrom: async () => 1,
        confirmUpload: async () => {
          // accept: no-op
        },
        logToFile: async () => false
      })
    );

    const cli = container.resolve(Cli);
    await cli.run();

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.PK).toBe("keep");
  });
});
