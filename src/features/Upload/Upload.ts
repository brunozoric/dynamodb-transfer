import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Logger } from "~/features/Logger/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { DynamoDbClientFactory } from "~/features/DynamoDbClient/index.ts";
import type { DynamoDbClient } from "~/features/DynamoDbClient/index.ts";
import { NdJsonLineAccumulator } from "~/features/NdJsonLineAccumulator/index.ts";
import { RecordModifier } from "~/features/RecordModifier/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { Upload as UploadAbstraction } from "./abstractions/index.ts";

const CHUNK_SIZE = 25;

class UploadImpl implements UploadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly paths: Paths.Interface,
        private readonly clientFactory: DynamoDbClientFactory.Interface,
        private readonly accumulator: NdJsonLineAccumulator.Interface,
        private readonly modifier: RecordModifier.Interface
    ) {}

    public async run(options: UploadAbstraction.RunOptions): Promise<void> {
        const { sourcePath, table, startFrom } = options;
        const client = this.clientFactory.create(table);
        const format = this.paths.detectFormat(sourcePath);
        try {
            if (format === "ndjson") {
                await this.sendNdjson(client, table, sourcePath, startFrom);
            } else if (format === "json") {
                await this.sendJson(client, table, sourcePath, startFrom);
            } else {
                throw new Error(`Unknown file format for ${sourcePath}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Upload failed: ${message}`);
        }
    }

    private extractKeys(record: Record<string, unknown>): Record<string, unknown> {
        const keys: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(record)) {
            if (k === "PK" || k === "SK" || /^GSI\d+_(PK|SK)$/.test(k)) {
                keys[k] = v;
            }
        }
        return keys;
    }

    private async prepare(
        record: Record<string, unknown>,
        table: Config.ResolvedTable,
        sourcePath: string
    ): Promise<DynamoDbClient.Record | null> {
        const stamped = { ...record, _tt: Date.now() };
        const modified = await this.modifier.modify({ record: stamped, table, sourcePath });
        if (modified === null) {
            this.logger.debug(`Skipping record: ${JSON.stringify(this.extractKeys(stamped))}`);
            return null;
        }
        return modified as DynamoDbClient.Record;
    }

    private async sendJson(
        client: DynamoDbClient.Interface,
        table: Config.ResolvedTable,
        sourcePath: string,
        startFrom: number
    ): Promise<void> {
        const items = JSON.parse(readFileSync(sourcePath, "utf-8")) as Record<string, unknown>[];
        let written = startFrom;
        for (let i = startFrom; i < items.length; i += CHUNK_SIZE) {
            const prepared = await Promise.all(
                items.slice(i, i + CHUNK_SIZE).map(r => this.prepare(r, table, sourcePath))
            );
            const chunk = prepared.filter((r): r is DynamoDbClient.Record => r !== null);
            if (chunk.length > 0) {
                await client.batchPut(table.name, chunk);
            }
            written += chunk.length;
            this.logger.info(`Written ${written}/${items.length}`);
        }
        this.logger.done(`Wrote ${written - startFrom} items to ${table.name}`);
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
            const prepared = await this.prepare(parsed, table, sourcePath);
            if (prepared === null) {
                continue;
            }
            buffer.push(prepared);
            if (buffer.length >= CHUNK_SIZE) {
                await client.batchPut(table.name, buffer);
                written += buffer.length;
                this.logger.info(`Written ${startFrom + written} items...`);
                buffer = [];
            }
        }
        const flushed = await this.accumulator.flush(table);
        if (flushed !== null) {
            const preparedFlushed = await this.prepare(flushed, table, sourcePath);
            if (preparedFlushed !== null) {
                buffer.push(preparedFlushed);
            }
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
    dependencies: [Logger, Paths, DynamoDbClientFactory, NdJsonLineAccumulator, RecordModifier]
});
