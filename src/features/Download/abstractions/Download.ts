import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";

export interface IDownload {
    run(options: IDownloadRunOptions): Promise<void>;
}

export interface IDownloadRunOptions {
    table: Config.ResolvedTable;
    destPath: string;
    format: Paths.DownloadFormat;
    segments: number;
}

export const Download = createAbstraction<IDownload>("Commands/Download");

export namespace Download {
    export type Interface = IDownload;
    export type RunOptions = IDownloadRunOptions;
}
