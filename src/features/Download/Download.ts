import { createReadStream, createWriteStream, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
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
        let total = 0;
        const segmentPaths = Array.from({ length: segments }, (_, i) => `${destPath}.seg${i}`);

        const worker = async (segmentPath: string, segment: number): Promise<void> => {
            const stream = createWriteStream(segmentPath);
            let segmentCount = 0;
            try {
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
            } finally {
                await this.closeStream(stream);
            }
        };

        try {
            await Promise.all(segmentPaths.map((segPath, i) => worker(segPath, i)));
            await this.concatenateSegments(segmentPaths, destPath);
        } finally {
            await this.deleteSegmentFiles(segmentPaths);
        }
        this.logger.done(`Exported ${total} items to ${destPath}`);
    }

    private async concatenateSegments(segmentPaths: string[], destPath: string): Promise<void> {
        const dest = createWriteStream(destPath);
        try {
            for (const segPath of segmentPaths) {
                await this.pipeSegment(segPath, dest);
            }
        } finally {
            await this.closeStream(dest);
        }
    }

    private pipeSegment(sourcePath: string, dest: WriteStream): Promise<void> {
        return new Promise((resolve, reject) => {
            const source = createReadStream(sourcePath);
            source.pipe(dest, { end: false });
            source.once("end", resolve);
            source.once("error", reject);
        });
    }

    private async deleteSegmentFiles(paths: string[]): Promise<void> {
        for (const segPath of paths) {
            try {
                await unlink(segPath);
            } catch {
                // file may not exist if the worker failed before creating it
            }
        }
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
