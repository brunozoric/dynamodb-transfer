import { Logger } from "~/features/Logger/index.ts";
import { Prompter } from "~/features/Prompter/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { Config } from "~/features/Config/index.ts";
import { Download } from "~/features/Download/index.ts";
import { Upload } from "~/features/Upload/index.ts";
import { Cli as CliAbstraction } from "./abstractions/index.ts";

class CliImpl implements CliAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly prompter: Prompter.Interface,
        private readonly paths: Paths.Interface,
        private readonly config: Config.Interface,
        private readonly download: Download.Interface,
        private readonly upload: Upload.Interface
    ) {}

    public async run(): Promise<void> {
        const tables = await this.config.load();
        const action = await this.prompter.action();

        if (action === "exit") {
            return;
        }

        if (action === "download") {
            await this.runDownload(tables);
            return;
        }

        await this.runUpload(tables);
    }

    private async runDownload(tables: Config.ResolvedTable[]): Promise<void> {
        const table = await this.prompter.table({
            tables,
            message: "Which table do you want to download?"
        });
        const segments = await this.prompter.segments();
        const format = await this.prompter.downloadFormat({ segments });
        const initialPath = this.paths.dataFilePath({
            description: table.description,
            format
        });
        const destPath = await this.prompter.destPath({
            initialPath,
            extension: this.paths.extensionFor(format)
        });
        if (destPath === null) {
            return;
        }
        await this.download.run({ table, destPath, format, segments });
    }

    private async runUpload(tables: Config.ResolvedTable[]): Promise<void> {
        const writableTables = tables.filter(t => t.writable);
        if (writableTables.length === 0) {
            this.logger.info(
                "No writable tables in config.ts. Set `writable: true` on the table you want to upload to."
            );
            return;
        }
        const sourcePath = await this.prompter.sourceFile();
        if (sourcePath === null) {
            this.logger.info("No files in data/ to upload.");
            return;
        }
        const table = await this.prompter.table({
            tables: writableTables,
            message: "Which table should receive the data?"
        });
        await this.prompter.confirmUpload({ sourcePath, table });
        await this.upload.run({ sourcePath, table });
    }
}

export const Cli = CliAbstraction.createImplementation({
    implementation: CliImpl,
    dependencies: [Logger, Prompter, Paths, Config, Download, Upload]
});
