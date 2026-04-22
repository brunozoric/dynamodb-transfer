import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  BatchWriteItemCommand,
  ScanCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { randomUUID } from "node:crypto";

const client = new DynamoDBClient({});

export interface TestTableSchema {
  partitionKey: string;
}

const DEFAULT_SCHEMA: TestTableSchema = { partitionKey: "PK" };

export async function createTestTable(schema: TestTableSchema = DEFAULT_SCHEMA): Promise<string> {
  const tableName = `test-${randomUUID()}`;
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: schema.partitionKey, AttributeType: "S" }],
      KeySchema: [{ AttributeName: schema.partitionKey, KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST"
    })
  );
  return tableName;
}

export async function dropTestTable(tableName: string): Promise<void> {
  await client.send(new DeleteTableCommand({ TableName: tableName }));
}

export async function putTestItems(
  tableName: string,
  items: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: chunk.map(item => ({
            PutRequest: { Item: marshall(item) }
          }))
        }
      })
    );
  }
}

export async function scanAllItems(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, AttributeValue> | undefined;
  do {
    const result = await client.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    for (const item of result.Items ?? []) {
      items.push(unmarshall(item));
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}
