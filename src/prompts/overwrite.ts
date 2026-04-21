import { select, input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../lib/paths.js";

type OverwriteChoice = "overwrite" | "rename" | "cancel";

export const resolveDestPath = async (
    initialPath: string,
    extension: string
): Promise<string | null> => {
    let path = initialPath;
    while (existsSync(path)) {
        const choice = await select<OverwriteChoice>({
            message: `${path} already exists. What do you want to do?`,
            choices: [
                { name: "Overwrite", value: "overwrite" },
                { name: "Enter a new filename", value: "rename" },
                { name: "Cancel", value: "cancel" }
            ]
        });
        if (choice === "overwrite") return path;
        if (choice === "cancel") return null;
        const raw = await input({
            message: "New filename (without path):",
            validate: value => {
                const trimmed = value.trim();
                if (trimmed.length === 0) return "Filename cannot be empty";
                if (trimmed.includes("/") || trimmed.includes("\\")) {
                    return "Filename must not contain slashes";
                }
                const withoutExt = trimmed.endsWith(extension)
                    ? trimmed.slice(0, -extension.length)
                    : trimmed;
                if (withoutExt.length > 25) {
                    return `Filename must be 25 characters or fewer (excluding ${extension})`;
                }
                return true;
            }
        });
        const trimmed = raw.trim();
        const basename = trimmed.endsWith(extension) ? trimmed : `${trimmed}${extension}`;
        path = join(DATA_DIR, basename);
    }
    return path;
};
