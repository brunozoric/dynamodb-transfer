import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Logger } from "~/features/Logger/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { DynamoDbClientFactory } from "~/features/DynamoDbClient/index.ts";
import type { DynamoDbClient } from "~/features/DynamoDbClient/index.ts";
import { NdJsonLineAccumulator } from "~/features/NdJsonLineAccumulator/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { Upload as UploadAbstraction } from "./abstractions/index.ts";

const CHUNK_SIZE = 25;

class UploadImpl implements UploadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly paths: Paths.Interface,
        private readonly clientFactory: DynamoDbClientFactory.Interface,
        private readonly accumulator: NdJsonLineAccumulator.Interface
    ) {}

    public async run(options: UploadAbstraction.RunOptions): Promise<void> {
        const { sourcePath, table, startFrom } = options;
        const client = this.clientFactory.create(table);
        const format = this.paths.detectFormat(sourcePath);
        try {
            if (format === "ndjson") {
                await this.sendNdjson(client, table, sourcePath, startFrom);
            } else if (format === "json") {
                await this.sendJson(client, table.name, sourcePath, startFrom);
            } else {
                throw new Error(`Unknown file format for ${sourcePath}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Upload failed: ${message}`);
        }
    }

    private async sendJson(
        client: DynamoDbClient.Interface,
        tableName: string,
        sourcePath: string,
        startFrom: number
    ): Promise<void> {
        const items = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>[];
        let written = startFrom;
        for (let i = startFrom; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE) as DynamoDbClient.Record[];
            await client.batchPut(tableName, chunk);
            written += chunk.length;
            this.logger.info(`Written ${written}/${items.length}`);
        }
        this.logger.done(`Wrote ${written - startFrom} items to ${tableName}`);
    }

    private async sendNdjson(
        client: DynamoDbClient.Interface,
        table: Config.ResolvedTable,
        sourcePath: string,
        startFrom: number
    ): Promise<void> {
        const rl = createInterface({
            input: createReadStream(sourcePath),
            crlfDelay: Infinity
        });

        let buffer: DynamoDbClient.Record[] = [];
        let written = 0;
        let lineIndex = 0;
        for await (const line of rl) {
            if (line.trim().length === 0) {
                continue;
            }
            if (lineIndex++ < startFrom) {
                continue;
            }
            const parsed = await this.accumulator.feed(line, table);
            if (parsed === null) {
                continue;
            }
            buffer.push(parsed as DynamoDbClient.Record);
            if (buffer.length >= CHUNK_SIZE) {
                await client.batchPut(table.name, buffer);
                written += buffer.length;
                this.logger.info(`Written ${startFrom + written} items...`);
                buffer = [];
            }
        }
        const flushed = await this.accumulator.flush(table);
        if (flushed !== null) {
            buffer.push(flushed as DynamoDbClient.Record);
        }
        if (buffer.length > 0) {
            await client.batchPut(table.name, buffer);
            written += buffer.length;
        }
        this.logger.done(`Wrote ${written} items to ${table.name}`);
    }
}

export const Upload = UploadAbstraction.createImplementation({
    implementation: UploadImpl,
    dependencies: [Logger, Paths, DynamoDbClientFactory, NdJsonLineAccumulator]
});
