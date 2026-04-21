import { loadConfig } from "./config/load.js";
import { runDownload } from "./commands/download.js";
import { runSend } from "./commands/send.js";
import { dataFilePath, extensionFor } from "./lib/paths.js";
import { promptAction } from "./prompts/action.js";
import { confirmSend } from "./prompts/confirmSend.js";
import { promptDownloadFormat } from "./prompts/downloadFormat.js";
import { resolveDestPath } from "./prompts/overwrite.js";
import { promptSourceFile } from "./prompts/sourceFile.js";
import { promptTable } from "./prompts/table.js";

const main = async (): Promise<void> => {
  const tables = await loadConfig();
  const action = await promptAction();

  if (action === "exit") return;

  if (action === "download") {
    const table = await promptTable(tables, "Which table do you want to download?");
    const format = await promptDownloadFormat();
    const initialPath = dataFilePath(table.description, format);
    const destPath = await resolveDestPath(initialPath, extensionFor(format));
    if (destPath === null) return;
    await runDownload(table, destPath, format);
    return;
  }

  // action === "send"
  const sourcePath = await promptSourceFile();
  if (sourcePath === null) {
    console.log("No files in data/ to send.");
    return;
  }
  const table = await promptTable(tables, "Which table should receive the data?");
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
