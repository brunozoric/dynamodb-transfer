import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { BatchWriteCommandInput, BatchWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { ClientFactory } from "~/features/AwsClient/index.ts";
import { Logger } from "~/features/Logger/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { Upload as UploadAbstraction } from "./abstractions/index.ts";

const CHUNK_SIZE = 25;
const BACKOFF_MS = 500;

class UploadImpl implements UploadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly paths: Paths.Interface,
        private readonly clientFactory: ClientFactory.Interface
    ) {}

    public async run(options: UploadAbstraction.RunOptions): Promise<void> {
        const { sourcePath, table } = options;
        const client = this.clientFactory.create(table);
        const format = this.paths.detectFormat(sourcePath);
        try {
            if (format === "ndjson") {
                await this.sendNdjson(client, table.name, sourcePath);
            } else if (format === "json") {
                await this.sendJson(client, table.name, sourcePath);
            } else {
                throw new Error(`Unknown file format for ${sourcePath}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Upload failed: ${message}`);
        }
    }

    private async sendJson(
        client: ClientFactory.Client,
        tableName: string,
        sourcePath: string
    ): Promise<void> {
        const items = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>[];
        let written = 0;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            await this.sendChunk(client, tableName, chunk);
            written += chunk.length;
            this.logger.info(`Written ${written}/${items.length}`);
        }
        this.logger.info(`Wrote ${items.length} items to ${tableName}`);
    }

    private async sendNdjson(
        client: ClientFactory.Client,
        tableName: string,
        sourcePath: string
    ): Promise<void> {
        const rl = createInterface({
            input: createReadStream(sourcePath),
            crlfDelay: Infinity
        });

        let buffer: Record<string, unknown>[] = [];
        let written = 0;
        for await (const line of rl) {
            if (line.trim().length === 0) {
                continue;
            }
            buffer.push(JSON.parse(line) as Record<string, unknown>);
            if (buffer.length >= CHUNK_SIZE) {
                await this.sendChunk(client, tableName, buffer);
                written += buffer.length;
                this.logger.info(`Written ${written} items...`);
                buffer = [];
            }
        }
        if (buffer.length > 0) {
            await this.sendChunk(client, tableName, buffer);
            written += buffer.length;
        }
        this.logger.info(`Wrote ${written} items to ${tableName}`);
    }

    private async sendChunk(
        client: ClientFactory.Client,
        tableName: string,
        chunk: Record<string, unknown>[]
    ): Promise<void> {
        let unprocessed: BatchWriteCommandInput["RequestItems"] = {
            [tableName]: chunk.map(Item => ({ PutRequest: { Item } }))
        };
        while (unprocessed !== undefined && Object.keys(unprocessed).length > 0) {
            const requestItems: BatchWriteCommandInput["RequestItems"] = unprocessed;
            const result: BatchWriteCommandOutput = await client.send(
                new BatchWriteCommand({ RequestItems: requestItems })
            );
            unprocessed =
                result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0
                    ? result.UnprocessedItems
                    : undefined;
            if (unprocessed) {
                await new Promise(r => setTimeout(r, BACKOFF_MS));
            }
        }
    }
}

export const Upload = UploadAbstraction.createImplementation({
    implementation: UploadImpl,
    dependencies: [Logger, Paths, ClientFactory]
});
