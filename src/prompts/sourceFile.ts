import { select } from "@inquirer/prompts";
import { join } from "node:path";
import { DATA_DIR, listDataFiles } from "../lib/paths.js";

export const promptSourceFile = async (): Promise<string | null> => {
    const files = listDataFiles();
    if (files.length === 0) return null;
    return select<string>({
        message: "Which file do you want to send?",
        choices: files.map(file => ({
            name: file,
            value: join(DATA_DIR, file)
        }))
    });
};
