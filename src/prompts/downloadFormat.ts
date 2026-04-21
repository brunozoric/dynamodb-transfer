import { select } from "@inquirer/prompts";
import type { DownloadFormat } from "../lib/paths.js";

export const promptDownloadFormat = (): Promise<DownloadFormat> =>
  select<DownloadFormat>({
    message: "Which file format?",
    choices: [
      {
        name: "NDJSON — one item per line, streamed (best for large tables)",
        value: "ndjson",
      },
      {
        name: "JSON array — pretty-printed single array",
        value: "json",
      },
    ],
    default: "ndjson",
  });
