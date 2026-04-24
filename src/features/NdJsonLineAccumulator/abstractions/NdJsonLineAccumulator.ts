import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";

export interface INdJsonLineAccumulator {
    feed(line: string, table: Config.ResolvedTable): Promise<Record<string, unknown> | null>;
    flush(table: Config.ResolvedTable): Promise<Record<string, unknown> | null>;
}

export const NdJsonLineAccumulator = createAbstraction<INdJsonLineAccumulator>(
    "Upload/NdJsonLineAccumulator"
);

export namespace NdJsonLineAccumulator {
    export type Interface = INdJsonLineAccumulator;
}
