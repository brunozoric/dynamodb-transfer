import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Paths as PathsAbstraction } from "./abstractions/index.ts";

const DATA_DIR = "data";

const EXTENSIONS: Record<PathsAbstraction.DownloadFormat, string> = {
    ndjson: ".ndjson",
    json: ".json"
};

function toCamelCase(name: string): string {
    const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if (parts.length === 0) {
        return name;
    }
    return parts
        .map((p, i) =>
            i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
        )
        .join("");
}

class PathsImpl implements PathsAbstraction.Interface {
    public dataFilePath(options: PathsAbstraction.DataFilePathOptions): string {
        return join(DATA_DIR, `${toCamelCase(options.description)}${EXTENSIONS[options.format]}`);
    }

    public inDataDir(basename: string): string {
        return join(DATA_DIR, basename);
    }

    public extensionFor(format: PathsAbstraction.DownloadFormat): string {
        return EXTENSIONS[format];
    }

    public listDataFiles(): string[] {
        if (!existsSync(DATA_DIR)) {
            return [];
        }
        return readdirSync(DATA_DIR)
            .filter(name => name.endsWith(".json") || name.endsWith(".ndjson"))
            .sort()
            .map(name => join(DATA_DIR, name));
    }

    public detectFormat(filename: string): PathsAbstraction.DownloadFormat | null {
        if (filename.endsWith(".ndjson")) {
            return "ndjson";
        }
        if (filename.endsWith(".json")) {
            return "json";
        }
        return null;
    }
}

export const Paths = PathsAbstraction.createImplementation({
    implementation: PathsImpl,
    dependencies: []
});
