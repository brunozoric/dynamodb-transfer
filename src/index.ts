import { Container } from "@webiny/di";
import { Config, ConfigFeature } from "~/features/Config/index.ts";
import { AwsClientFeature } from "~/features/AwsClient/index.ts";
import { Download, DownloadFeature } from "~/features/Download/index.ts";
import { runSend } from "./commands/send.ts";
import { dataFilePath, extensionFor } from "./lib/paths.js";
import { promptAction } from "./prompts/action.js";
import { confirmSend } from "./prompts/confirmSend.js";
import { promptDownloadFormat } from "./prompts/downloadFormat.js";
import { resolveDestPath } from "./prompts/overwrite.js";
import { promptSegments } from "./prompts/segments.js";
import { promptSourceFile } from "./prompts/sourceFile.js";
import { promptTable } from "./prompts/table.js";

const container = new Container();
ConfigFeature.register(container);
AwsClientFeature.register(container);
DownloadFeature.register(container);
const config = container.resolve(Config);
const download = container.resolve(Download);

const main = async (): Promise<void> => {
    const tables = await config.load();
    const action = await promptAction();

    if (action === "exit") return;

    if (action === "download") {
        const table = await promptTable(tables, "Which table do you want to download?");
        const segments = await promptSegments();
        const format = await promptDownloadFormat(segments);
        const initialPath = dataFilePath(table.description, format);
        const destPath = await resolveDestPath(initialPath, extensionFor(format));
        if (destPath === null) return;
        await download.run({ table, destPath, format, segments });
        return;
    }

    // action === "send" — still on the old path until Task 5
    const writableTables = tables.filter(t => t.writable);
    if (writableTables.length === 0) {
        console.log(
            "No writable tables in config.ts. Set `writable: true` on the table you want to send to."
        );
        return;
    }
    const sourcePath = await promptSourceFile();
    if (sourcePath === null) {
        console.log("No files in data/ to send.");
        return;
    }
    const table = await promptTable(writableTables, "Which table should receive the data?");
    await confirmSend(sourcePath, table);
    await runSend(sourcePath, table);
};

try {
    await main();
} catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
}
