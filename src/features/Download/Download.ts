import { createWriteStream, writeFileSync } from "node:fs";
import type { WriteStream } from "node:fs";
import { Logger } from "~/features/Logger/index.ts";
import { DynamoDbClientFactory } from "~/features/DynamoDbClient/index.ts";
import type { DynamoDbClient } from "~/features/DynamoDbClient/index.ts";
import { Download as DownloadAbstraction } from "./abstractions/index.ts";

class DownloadImpl implements DownloadAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly clientFactory: DynamoDbClientFactory.Interface
    ) {}

    public async run(options: DownloadAbstraction.RunOptions): Promise<void> {
        const { table, destPath, format, segments } = options;
        const client = this.clientFactory.create(table);
        try {
            if (format === "ndjson") {
                await this.downloadNdjson(client, table.name, destPath, segments);
            } else {
                await this.downloadJson(client, table.name, destPath);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Download failed: ${message}`);
        }
    }

    private async downloadJson(
        client: DynamoDbClient.Interface,
        tableName: string,
        destPath: string
    ): Promise<void> {
        const items: Record<string, unknown>[] = [];
        for await (const item of client.scan(tableName)) {
            items.push(item);
            if (items.length % 1000 === 0) {
                this.logger.info(`Scanned ${items.length} items...`);
            }
        }
        writeFileSync(destPath, JSON.stringify(items, null, 2));
        this.logger.done(`Exported ${items.length} items to ${destPath}`);
    }

    private async downloadNdjson(
        client: DynamoDbClient.Interface,
        tableName: string,
        destPath: string,
        segments: number
    ): Promise<void> {
        const stream = createWriteStream(destPath);
        let total = 0;

        const worker = async (segment: number): Promise<void> => {
            let segmentCount = 0;
            for await (const item of client.scan(tableName, {
                segment,
                totalSegments: segments
            })) {
                await this.writeLine(stream, JSON.stringify(item) + "\n");
                segmentCount++;
                total++;
                if (segmentCount % 1000 === 0) {
                    this.logger.info(
                        segments > 1
                            ? `Seg ${segment}: ${segmentCount} items (total ${total})`
                            : `Scanned ${total} items...`
                    );
                }
            }
        };

        try {
            await Promise.all(Array.from({ length: segments }, (_, i) => worker(i)));
        } finally {
            await this.closeStream(stream);
        }
        this.logger.done(`Exported ${total} items to ${destPath}`);
    }

    private writeLine(stream: WriteStream, line: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ok = stream.write(line, err => {
                if (err) {
                    reject(err);
                }
            });
            if (ok) {
                resolve();
                return;
            }
            const onDrain = (): void => {
                stream.off("error", onError);
                resolve();
            };
            const onError = (err: Error): void => {
                stream.off("drain", onDrain);
                reject(err);
            };
            stream.once("drain", onDrain);
            stream.once("error", onError);
        });
    }

    private closeStream(stream: WriteStream): Promise<void> {
        return new Promise((resolve, reject) => {
            stream.once("finish", () => resolve());
            stream.once("error", reject);
            stream.end();
        });
    }
}

export const Download = DownloadAbstraction.createImplementation({
    implementation: DownloadImpl,
    dependencies: [Logger, DynamoDbClientFactory]
});
