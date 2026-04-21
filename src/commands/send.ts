import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { BatchWriteCommandInput, BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "../aws/client.js";
import type { Client } from "../aws/client.js";
import type { ResolvedTable } from "../config/define.js";
import { detectFormat } from "../lib/paths.js";

const CHUNK_SIZE = 25;
const BACKOFF_MS = 500;

export const runSend = async (
  sourcePath: string,
  table: ResolvedTable
): Promise<void> => {
  const client = createClient(table);
  const format = detectFormat(sourcePath);
  try {
    if (format === "ndjson") {
      await sendNdjson(client, table.name, sourcePath);
    } else if (format === "json") {
      await sendJson(client, table.name, sourcePath);
    } else {
      throw new Error(`Unknown file format for ${sourcePath}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Send failed: ${message}`);
  }
};

const sendJson = async (
  client: Client,
  tableName: string,
  sourcePath: string
): Promise<void> => {
  const items = JSON.parse(
    readFileSync(sourcePath, "utf-8")
  ) as Record<string, unknown>[];

  let written = 0;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await sendChunk(client, tableName, chunk);
    written += chunk.length;
    console.log(`Written ${written}/${items.length}`);
  }
  console.log(`Wrote ${items.length} items to ${tableName}`);
};

const sendNdjson = async (
  client: Client,
  tableName: string,
  sourcePath: string
): Promise<void> => {
  const rl = createInterface({
    input: createReadStream(sourcePath),
    crlfDelay: Infinity,
  });

  let buffer: Record<string, unknown>[] = [];
  let written = 0;
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    buffer.push(JSON.parse(line) as Record<string, unknown>);
    if (buffer.length >= CHUNK_SIZE) {
      await sendChunk(client, tableName, buffer);
      written += buffer.length;
      console.log(`Written ${written} items...`);
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    await sendChunk(client, tableName, buffer);
    written += buffer.length;
  }
  console.log(`Wrote ${written} items to ${tableName}`);
};

const sendChunk = async (
  client: Client,
  tableName: string,
  chunk: Record<string, unknown>[]
): Promise<void> => {
  let unprocessed: BatchWriteCommandInput["RequestItems"] = {
    [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
  };
  while (unprocessed !== undefined && Object.keys(unprocessed).length > 0) {
    const requestItems: BatchWriteCommandInput["RequestItems"] = unprocessed;
    const result: BatchWriteCommandOutput = await client.send(
      new BatchWriteCommand({ RequestItems: requestItems })
    );
    unprocessed =
      result.UnprocessedItems &&
      Object.keys(result.UnprocessedItems).length > 0
        ? result.UnprocessedItems
        : undefined;
    if (unprocessed) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS));
    }
  }
};
