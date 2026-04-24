import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface IModifyOptions {
    record: Record<string, unknown>;
    table: Config.ResolvedTable;
    sourcePath: string;
}

export interface IRecordModifier {
    modify(options: IModifyOptions): Promise<Record<string, unknown>>;
}

export const RecordModifier = createAbstraction<IRecordModifier>("Upload/RecordModifier");

export namespace RecordModifier {
    export type Interface = IRecordModifier;
    export type ModifyOptions = IModifyOptions;
}
