import { select, input, confirm } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { Config } from "~/features/Config/index.ts";
import { Paths } from "~/features/Paths/index.ts";
import { Prompter as PrompterAbstraction } from "./abstractions/index.ts";

type OverwriteChoice = "overwrite" | "rename" | "cancel";

class PrompterImpl implements PrompterAbstraction.Interface {
    public constructor(private readonly paths: Paths.Interface) {}

    public action(): Promise<PrompterAbstraction.Action> {
        return select<PrompterAbstraction.Action>({
            message: "What would you like to do?",
            choices: [
                { name: "Download a table", value: "download" },
                { name: "Upload a file to a table", value: "upload" },
                { name: "Exit", value: "exit" }
            ]
        });
    }

    public table(options: PrompterAbstraction.TableOptions): Promise<Config.ResolvedTable> {
        return select<Config.ResolvedTable>({
            message: options.message,
            choices: options.tables.map(table => ({
                name: `${table.description} — ${table.name} (${table.region}, profile: ${table.awsProfile})`,
                value: table
            }))
        });
    }

    public downloadFormat(
        options: PrompterAbstraction.DownloadFormatOptions
    ): Promise<Paths.DownloadFormat> {
        const parallel = options.segments > 1;
        return select<Paths.DownloadFormat>({
            message: "Which file format?",
            choices: [
                {
                    name: "NDJSON — one item per line, streamed (best for large tables)",
                    value: "ndjson"
                },
                {
                    name: "JSON array — pretty-printed single array",
                    value: "json",
                    disabled: parallel ? "(requires 1 segment)" : false
                }
            ],
            default: "ndjson"
        });
    }

    public async segments(): Promise<number> {
        const raw = await input({
            message: "Number of parallel scan segments (1-16):",
            default: "4",
            validate: value => {
                const trimmed = value.trim();
                if (!/^\d+$/.test(trimmed)) {
                    return "Must be a whole number";
                }
                const n = Number(trimmed);
                if (n < 1) {
                    return "Must be at least 1";
                }
                if (n > 16) {
                    return "Must be 16 or fewer";
                }
                return true;
            }
        });
        return Number(raw.trim());
    }

    public async sourceFile(): Promise<string | null> {
        const paths = this.paths.listDataFiles();
        if (paths.length === 0) {
            return null;
        }
        return select<string>({
            message: "Which file do you want to upload?",
            choices: paths.map(p => ({
                name: basename(p),
                value: p
            }))
        });
    }

    public async destPath(options: PrompterAbstraction.DestPathOptions): Promise<string | null> {
        let path = options.initialPath;
        while (existsSync(path)) {
            const choice = await select<OverwriteChoice>({
                message: `${path} already exists. What do you want to do?`,
                choices: [
                    { name: "Overwrite", value: "overwrite" },
                    { name: "Enter a new filename", value: "rename" },
                    { name: "Cancel", value: "cancel" }
                ]
            });
            if (choice === "overwrite") {
                return path;
            }
            if (choice === "cancel") {
                return null;
            }
            const raw = await input({
                message: "New filename (without path):",
                validate: value => {
                    const trimmed = value.trim();
                    if (trimmed.length === 0) {
                        return "Filename cannot be empty";
                    }
                    if (trimmed.includes("/") || trimmed.includes("\\")) {
                        return "Filename must not contain slashes";
                    }
                    const withoutExt = trimmed.endsWith(options.extension)
                        ? trimmed.slice(0, -options.extension.length)
                        : trimmed;
                    if (withoutExt.length > 40) {
                        return `Filename must be 40 characters or fewer (excluding ${options.extension})`;
                    }
                    return true;
                }
            });
            const trimmed = raw.trim();
            const newBasename = trimmed.endsWith(options.extension)
                ? trimmed
                : `${trimmed}${options.extension}`;
            path = this.paths.inDataDir(newBasename);
        }
        return path;
    }

    public async confirmUpload(options: PrompterAbstraction.ConfirmUploadOptions): Promise<void> {
        console.log("");
        const resumeNote =
            options.startFrom > 0
                ? `, starting from ${options.format === "json" ? "index" : "line"} ${options.startFrom}`
                : "";
        console.log(
            `About to write ${options.sourcePath} → ${options.table.name} (${options.table.region}, profile: ${options.table.awsProfile})${resumeNote}`
        );
        await input({
            message: `Type the destination table name to confirm (${options.table.name}), or Ctrl+C to cancel:`,
            validate: value =>
                value.trim() === options.table.name ||
                `Input does not match "${options.table.name}". Try again or press Ctrl+C to cancel.`
        });
    }

    public logToFile(): Promise<boolean> {
        return confirm({
            message: "Save logs to a file?",
            default: false
        });
    }

    public async startFrom(): Promise<number> {
        const raw = await input({
            message: "Start from index (JSON) or line (NDJSON) — 0 to start from the beginning:",
            default: "0",
            validate: value => {
                const trimmed = value.trim();
                if (!/^\d+$/.test(trimmed)) {
                    return "Must be a whole number";
                }
                return true;
            }
        });
        return Number(raw.trim());
    }
}

export const Prompter = PrompterAbstraction.createImplementation({
    implementation: PrompterImpl,
    dependencies: [Paths]
});
