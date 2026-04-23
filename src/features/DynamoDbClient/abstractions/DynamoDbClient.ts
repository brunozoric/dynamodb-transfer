import { createAbstraction } from "~/base/index.ts";

export interface DatabaseRecord {
    PK: string;
    SK: string;
    [key: string]: unknown;
}

export interface ScanOptions {
    segment?: number;
    totalSegments?: number;
}

export interface IDynamoDbClient {
    scan<T extends DatabaseRecord = DatabaseRecord>(
        tableName: string,
        options?: ScanOptions
    ): AsyncIterable<T>;
    batchPut<T extends DatabaseRecord>(tableName: string, records: T[]): Promise<void>;
}

export const DynamoDbClient = createAbstraction<IDynamoDbClient>("Core/DynamoDbClient");

export namespace DynamoDbClient {
    export type Interface = IDynamoDbClient;
    export type Record = DatabaseRecord;
    export type Scan = ScanOptions;
}
