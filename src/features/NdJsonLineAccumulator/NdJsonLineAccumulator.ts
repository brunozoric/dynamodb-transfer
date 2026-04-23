import { Logger } from "~/features/Logger/index.ts";
import { ParseNdJsonErrorHandler } from "~/features/ParseNdJsonErrorHandler/index.ts";
import type { Config } from "~/features/Config/index.ts";
import { NdJsonLineAccumulator as NdJsonLineAccumulatorAbstraction } from "./abstractions/index.ts";

export class NdJsonLineAccumulatorImpl implements NdJsonLineAccumulatorAbstraction.Interface {
    private pending: string[] = [];

    public constructor(
        private readonly logger: Logger.Interface,
        private readonly handler: ParseNdJsonErrorHandler.Interface
    ) {}

    public async feed(
        line: string,
        table: Config.ResolvedTable
    ): Promise<Record<string, unknown> | null> {
        if (this.pending.length === 0) {
            try {
                return JSON.parse(line) as Record<string, unknown>;
            } catch (_error) {
                this.logger.debug(`Failed to parse line, accumulating`);
                this.pending.push(line);
                return null;
            }
        }

        try {
            const combined = [...this.pending, line].join("\n");
            const record = JSON.parse(combined) as Record<string, unknown>;
            this.pending = [];
            return record;
        } catch (_error) {
            this.logger.debug(
                `Newline-joined accumulation did not parse, trying empty-string join`
            );
        }

        try {
            const combined = [...this.pending, line].join("");
            const record = JSON.parse(combined) as Record<string, unknown>;
            this.pending = [];
            return record;
        } catch (_error) {
            this.logger.debug(`Empty-string-joined accumulation did not parse, trying line alone`);
        }

        try {
            const record = JSON.parse(line) as Record<string, unknown>;
            const discardCount = this.pending.length;
            const discarded = this.pending.join("\n");
            this.pending = [];
            this.logger.warn(
                `Discarding ${discardCount} accumulated line(s) that could not form valid JSON`
            );
            await this.handler.handle({
                table,
                line: discarded,
                error: new Error("Accumulated lines could not form valid JSON")
            });
            return record;
        } catch (_error) {
            this.pending.push(line);
            return null;
        }
    }

    public async flush(table: Config.ResolvedTable): Promise<Record<string, unknown> | null> {
        if (this.pending.length === 0) {
            return null;
        }
        const discarded = this.pending.join("\n");
        this.pending = [];
        return this.handler.handle({
            table,
            line: discarded,
            error: new Error("Unexpected end of file while accumulating lines")
        });
    }
}

export const NdJsonLineAccumulator = NdJsonLineAccumulatorAbstraction.createImplementation({
    implementation: NdJsonLineAccumulatorImpl,
    dependencies: [Logger, ParseNdJsonErrorHandler]
});
