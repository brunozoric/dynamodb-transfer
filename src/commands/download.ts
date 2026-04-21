import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createWriteStream, writeFileSync } from "node:fs";
import type { WriteStream } from "node:fs";
import { createClient } from "../aws/client.js";
import type { Client } from "../aws/client.js";
import type { ResolvedTable } from "../config/define.js";
import type { DownloadFormat } from "../lib/paths.js";

export const runDownload = async (
    table: ResolvedTable,
    destPath: string,
    format: DownloadFormat
): Promise<void> => {
    const client = createClient(table);
    try {
        if (format === "ndjson") {
            await downloadNdjson(client, table.name, destPath);
        } else {
            await downloadJson(client, table.name, destPath);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Download failed: ${message}`);
    }
};

const downloadJson = async (client: Client, tableName: string, destPath: string): Promise<void> => {
    const items: Record<string, unknown>[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
        const result = await client.send(
            new ScanCommand({ TableName: tableName, ExclusiveStartKey })
        );
        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
        console.log(`Scanned ${items.length} items...`);
    } while (ExclusiveStartKey);

    writeFileSync(destPath, JSON.stringify(items, null, 2));
    console.log(`Exported ${items.length} items to ${destPath}`);
};

const downloadNdjson = async (
    client: Client,
    tableName: string,
    destPath: string
): Promise<void> => {
    const stream = createWriteStream(destPath);
    let total = 0;
    try {
        let ExclusiveStartKey: Record<string, unknown> | undefined;
        do {
            const result = await client.send(
                new ScanCommand({ TableName: tableName, ExclusiveStartKey })
            );
            for (const item of result.Items ?? []) {
                await writeLine(stream, JSON.stringify(item) + "\n");
            }
            total += result.Items?.length ?? 0;
            ExclusiveStartKey = result.LastEvaluatedKey;
            console.log(`Scanned ${total} items...`);
        } while (ExclusiveStartKey);
    } finally {
        await closeStream(stream);
    }
    console.log(`Exported ${total} items to ${destPath}`);
};

const writeLine = (stream: WriteStream, line: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const ok = stream.write(line, err => {
            if (err) reject(err);
        });
        if (ok) resolve();
        else stream.once("drain", resolve);
    });

const closeStream = (stream: WriteStream): Promise<void> =>
    new Promise((resolve, reject) => {
        stream.once("finish", () => resolve());
        stream.once("error", reject);
        stream.end();
    });
