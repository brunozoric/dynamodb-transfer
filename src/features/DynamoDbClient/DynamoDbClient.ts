import {
    BatchWriteCommand,
    DynamoDBDocumentClient,
    QueryCommand,
    ScanCommand
} from "@aws-sdk/lib-dynamodb";
import { SourceDynamoDbClient } from "./abstractions/DynamoDbClient.ts";
import type { DynamoDbClientConfig } from "./abstractions/DynamoDbClientConfig.ts";
import { isRetryableAwsError, retryBackoffMs } from "~/base/index.ts";
import type { Logger } from "~/features/Logger/index.ts";

const BATCH_SIZE = 25;
const DEFAULT_MAX_RETRIES = 6;
const DEFAULT_INITIAL_BACKOFF = 100;

export class DynamoDbClientImpl implements SourceDynamoDbClient.Interface {
    private readonly maxRetries: number;
    private readonly initialBackoff: number;

    public constructor(
        private readonly client: DynamoDBDocumentClient,
        private readonly logger: Logger.Interface,
        tuning?: DynamoDbClientConfig.Tuning
    ) {
        this.maxRetries = tuning?.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.initialBackoff = tuning?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF;
    }

    public async *scan<T extends SourceDynamoDbClient.Record = SourceDynamoDbClient.Record>(
        tableName: string,
        options?: SourceDynamoDbClient.Scan
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

    public async query<T extends SourceDynamoDbClient.Record>(
        tableName: string,
        pk: string,
        sk?: string,
        options?: SourceDynamoDbClient.Query
    ): Promise<T[]> {
        const pkAttr = options?.pkAttribute ?? "PK";
        let keyConditionExpression = `${pkAttr} = :pk`;
        const expressionAttributeValues: Record<string, unknown> = { ":pk": pk };

        if (sk) {
            if (options?.sortKeyCondition?.operator === "beginsWith") {
                keyConditionExpression += " AND begins_with(SK, :sk)";
            } else {
                keyConditionExpression += " AND SK = :sk";
            }
            expressionAttributeValues[":sk"] = sk;
        }

        const command = new QueryCommand({
            TableName: tableName,
            IndexName: options ? options.indexName : undefined,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: options ? options.limit : undefined
        });

        const response = await this.executeWithRetry(() => this.client.send(command));
        return (response.Items ?? []) as T[];
    }

    public async batchPut<T extends SourceDynamoDbClient.Record>(
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
