import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { DownloadFormat } from "~/lib/paths.ts";

export interface IDownload {
    run(options: IDownloadRunOptions): Promise<void>;
}

export interface IDownloadRunOptions {
    table: Config.ResolvedTable;
    destPath: string;
    format: DownloadFormat;
    segments: number;
}

export const Download = createAbstraction<IDownload>("Commands/Download");

export namespace Download {
    export type Interface = IDownload;
    export type RunOptions = IDownloadRunOptions;
}
