import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export const Upload = createAbstraction<Upload.Interface>("Commands/Upload");

export namespace Upload {
    export interface Interface {
        run(options: RunOptions): Promise<void>;
    }
    export interface RunOptions {
        sourcePath: string;
        table: Config.ResolvedTable;
    }
}
