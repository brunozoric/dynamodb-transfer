import { createAbstraction } from "~/base/index.ts";

export interface IWriteLogMapOptions {
    record: Record<string, unknown>;
    tableName: string;
    keys: Record<string, unknown>;
}

export interface IWriteLogMapper {
    map(options: IWriteLogMapOptions): Promise<Record<string, unknown>>;
}

export const WriteLogMapper = createAbstraction<IWriteLogMapper>("Upload/WriteLogMapper");

export namespace WriteLogMapper {
    export type Interface = IWriteLogMapper;
    export type MapOptions = IWriteLogMapOptions;
}
