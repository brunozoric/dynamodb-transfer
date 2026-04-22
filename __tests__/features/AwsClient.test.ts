import { afterEach, describe, expect, it } from "vitest";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ClientFactory } from "~/features/AwsClient/index.ts";
import { createTestContainer } from "../containers/createTestContainer.ts";
import { createTestTable, dropTestTable } from "../helpers/dynaliteTables.ts";

describe("ClientFactory", () => {
  const tablesToClean: string[] = [];
  afterEach(async () => {
    while (tablesToClean.length > 0) {
      const name = tablesToClean.pop();
      if (name !== undefined) {
        await dropTestTable(name);
      }
    }
  });

  it("creates a client that can scan a dynalite table", async () => {
    const container = createTestContainer();
    const factory = container.resolve(ClientFactory);

    const tableName = await createTestTable();
    tablesToClean.push(tableName);

    const client = factory.create({
      name: tableName,
      description: "Test",
      writable: true,
      awsProfile: "test",
      region: "us-east-1"
    });

    const result = await client.send(new ScanCommand({ TableName: tableName }));
    expect(result.Items).toEqual([]);
  });

  it("is registered as a singleton", () => {
    const container = createTestContainer();
    const a = container.resolve(ClientFactory);
    const b = container.resolve(ClientFactory);
    expect(a).toBe(b);
  });
});
