import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Upload } from "~/features/Upload/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";
import { createTestTable, dropTestTable, scanAllItems } from "../helpers/dynaliteTables.ts";

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

describe("Upload", () => {
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

  it("uploads items from an NDJSON source", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    const items = [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 }
    ];
    writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["a", "b"]);
  });

  it("uploads items from a JSON array source", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.json");
    const items = [{ PK: "x", value: "hello" }];
    writeFileSync(sourcePath, JSON.stringify(items, null, 2));

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.value).toBe("hello");
  });

  it("chunks large NDJSON sources into 25-item batches", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "big.ndjson");
    const items = Array.from({ length: 60 }, (_, i) => ({
      PK: `k${i}`,
      value: i
    }));
    writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 0 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(60);
  });

  it("wraps errors with 'Upload failed:' prefix", async () => {
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "missing.ndjson");

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await expect(
      upload.run({ sourcePath, table: makeTable("does-not-exist"), startFrom: 0 })
    ).rejects.toThrowError(/^Upload failed:/);
  });

  it("resumes NDJSON upload from a given line, skipping earlier items", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.ndjson");
    const items = [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 },
      { PK: "c", value: 3 }
    ];
    writeFileSync(sourcePath, items.map(i => JSON.stringify(i)).join("\n") + "\n");

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 1 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(2);
    expect(scanned.map(s => s.PK).sort()).toEqual(["b", "c"]);
  });

  it("resumes JSON upload from a given index, skipping earlier items", async () => {
    const tableName = await createTestTable();
    tablesToClean.push(tableName);
    const dir = makeTmpDir();
    dirsToClean.push(dir);
    const sourcePath = join(dir, "data.json");
    const items = [
      { PK: "a", value: 1 },
      { PK: "b", value: 2 },
      { PK: "c", value: 3 }
    ];
    writeFileSync(sourcePath, JSON.stringify(items));

    const container = createTestContainer();
    const upload = container.resolve(Upload);
    await upload.run({ sourcePath, table: makeTable(tableName), startFrom: 2 });

    const scanned = await scanAllItems(tableName);
    expect(scanned).toHaveLength(1);
    expect(scanned[0]?.PK).toBe("c");
  });
});
