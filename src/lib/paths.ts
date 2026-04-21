import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DATA_DIR = "data";

export type DownloadFormat = "ndjson" | "json";

const EXTENSIONS: Record<DownloadFormat, string> = {
    ndjson: ".ndjson",
    json: ".json"
};

export const toCamelCase = (name: string): string => {
    const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if (parts.length === 0) return name;
    return parts
        .map((p, i) =>
            i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        )
        .join("");
};

export const extensionFor = (format: DownloadFormat): string => EXTENSIONS[format];

export const dataFilePath = (description: string, format: DownloadFormat): string =>
    join(DATA_DIR, `${toCamelCase(description)}${EXTENSIONS[format]}`);

export const listDataFiles = (): string[] => {
    if (!existsSync(DATA_DIR)) return [];
    return readdirSync(DATA_DIR)
        .filter(name => name.endsWith(".json") || name.endsWith(".ndjson"))
        .sort();
};

export const detectFormat = (filename: string): DownloadFormat | null => {
    if (filename.endsWith(".ndjson")) return "ndjson";
    if (filename.endsWith(".json")) return "json";
    return null;
};
