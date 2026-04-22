import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface IUpload {
    run(options: IUploadRunOptions): Promise<void>;
}

export interface IUploadRunOptions {
    sourcePath: string;
    table: Config.ResolvedTable;
}

export const Upload = createAbstraction<IUpload>("Commands/Upload");

export namespace Upload {
    export type Interface = IUpload;
    export type RunOptions = IUploadRunOptions;
}
