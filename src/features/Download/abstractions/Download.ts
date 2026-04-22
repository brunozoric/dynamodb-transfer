import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { DownloadFormat } from "~/lib/paths.ts";

export const Download = createAbstraction<Download.Interface>("Commands/Download");

export namespace Download {
    export interface Interface {
        run(options: RunOptions): Promise<void>;
    }
    export interface RunOptions {
        table: Config.ResolvedTable;
        destPath: string;
        format: DownloadFormat;
        segments: number;
    }
}
