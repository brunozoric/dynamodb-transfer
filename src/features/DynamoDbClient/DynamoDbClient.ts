import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDbClient } from "./abstractions/DynamoDbClient.ts";
import type { DynamoDbClientConfig } from "./abstractions/DynamoDbClientConfig.ts";
import { isRetryableAwsError, retryBackoffMs } from "~/base/index.ts";
import type { Logger } from "~/features/Logger/index.ts";
import type { WriteLogMapper } from "~/features/WriteLogMapper/index.ts";

const BATCH_SIZE = 25;
const DEFAULT_MAX_RETRIES = 6;
const DEFAULT_INITIAL_BACKOFF = 100;

export class DynamoDbClientImpl implements DynamoDbClient.Interface {
    private readonly maxRetries: number;
    private readonly initialBackoff: number;

    public constructor(
        private readonly client: DynamoDBDocumentClient,
        private readonly logger: Logger.Interface,
        private readonly writeLogMapper: WriteLogMapper.Interface,
        tuning?: DynamoDbClientConfig.Tuning
    ) {
        this.maxRetries = tuning?.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.initialBackoff = tuning?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF;
    }

    public async *scan<T extends DynamoDbClient.Record = DynamoDbClient.Record>(
        tableName: string,
        options?: DynamoDbClient.Scan
    ): AsyncIterable<T> {
        let lastEvaluatedKey: Record<string, unknown> | undefined;

        do {
            const command = new ScanCommand({
                TableName: tableName,
                Segment: options ? options.segment : undefined,
                TotalSegments: options ? options.totalSegments : undefined,
                ExclusiveStartKey: lastEvaluatedKey
            });

            const response = await this.executeWithRetry(() => this.client.send(command));

            if (response.Items) {
                for (const item of response.Items) {
                    yield item as T;
                }
            }

            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);
    }

    public async batchPut<T extends DynamoDbClient.Record>(
        tableName: string,
        records: T[]
    ): Promise<void> {
        if (records.length === 0) {
            return;
        }

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const command = new BatchWriteCommand({
                RequestItems: {
                    [tableName]: batch.map(record => ({ PutRequest: { Item: record } }))
                }
            });

            try {
                const response = await this.executeWithRetry(() => this.client.send(command));

                for (const record of batch) {
                    const keys = this.indexKeys(record);
                    const payload = await this.writeLogMapper.map({ record, tableName, keys });
                    if (payload !== null) {
                        this.logger.debug(`Wrote: ${JSON.stringify(payload)}`);
                    }
                }

                const unprocessed = response.UnprocessedItems?.[tableName];
                if (unprocessed && unprocessed.length > 0) {
                    const unprocessedRecords = unprocessed.map(item => item.PutRequest!.Item as T);
                    await this.batchPut(tableName, unprocessedRecords);
                }
            } catch (error) {
                const keys = batch.map(record => ({ PK: record.PK, SK: record.SK }));
                this.logger.error(
                    `DynamoDB batchPut failed after ${this.maxRetries + 1} attempts ` +
                        `against table "${tableName}" — batch of ${batch.length} records. ` +
                        `Keys: ${JSON.stringify(keys)}`
                );
                throw error;
            }
        }
    }

    private indexKeys(record: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
            if (key === "PK" || key === "SK" || key.includes("GSI")) {
                result[key] = value;
            }
        }
        return result;
    }

    private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                if (!isRetryableAwsError(error) || attempt === this.maxRetries) {
                    throw error;
                }

                const backoff = retryBackoffMs(attempt, this.initialBackoff);
                await new Promise(resolve => setTimeout(resolve, backoff));
            }
        }

        throw lastError;
    }
}
