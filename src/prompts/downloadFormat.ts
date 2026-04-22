import { select } from "@inquirer/prompts";
import type { DownloadFormat } from "~/lib/paths.ts";

export const promptDownloadFormat = (segments: number): Promise<DownloadFormat> => {
    const parallel = segments > 1;
    return select<DownloadFormat>({
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
};
