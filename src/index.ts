import { bootstrap } from "./bootstrap.ts";
import { Config } from "~/features/Config/index.ts";
import { Download } from "~/features/Download/index.ts";
import { Upload } from "~/features/Upload/index.ts";
import { Logger } from "~/features/Logger/index.ts";
import { Prompter } from "~/features/Prompter/index.ts";
import { Paths } from "~/features/Paths/index.ts";

const container = bootstrap();
const logger = container.resolve(Logger);
const prompter = container.resolve(Prompter);
const config = container.resolve(Config);
const download = container.resolve(Download);
const upload = container.resolve(Upload);
const paths = container.resolve(Paths);

const main = async (): Promise<void> => {
    const tables = await config.load();
    const action = await prompter.action();

    if (action === "exit") {
        return;
    }

    if (action === "download") {
        const table = await prompter.table({
            tables,
            message: "Which table do you want to download?"
        });
        const segments = await prompter.segments();
        const format = await prompter.downloadFormat({ segments });
        const initialPath = paths.dataFilePath({ description: table.description, format });
        const destPath = await prompter.destPath({
            initialPath,
            extension: paths.extensionFor(format)
        });
        if (destPath === null) {
            return;
        }
        await download.run({ table, destPath, format, segments });
        return;
    }

    // action === "upload"
    const writableTables = tables.filter(t => t.writable);
    if (writableTables.length === 0) {
        logger.info(
            "No writable tables in config.ts. Set `writable: true` on the table you want to upload to."
        );
        return;
    }
    const sourcePath = await prompter.sourceFile();
    if (sourcePath === null) {
        logger.info("No files in data/ to upload.");
        return;
    }
    const table = await prompter.table({
        tables: writableTables,
        message: "Which table should receive the data?"
    });
    await prompter.confirmUpload({ sourcePath, table });
    await upload.run({ sourcePath, table });
};

try {
    await main();
} catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
    }
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}
