import { createAbstraction } from "~/base/index.ts";

export type IDownloadFormat = "ndjson" | "json";

export interface IPaths {
    dataFilePath(options: IDataFilePathOptions): string;
    inDataDir(basename: string): string;
    extensionFor(format: IDownloadFormat): string;
    listDataFiles(): string[];
    detectFormat(filename: string): IDownloadFormat | null;
}

export interface IDataFilePathOptions {
    description: string;
    format: IDownloadFormat;
}

export const Paths = createAbstraction<IPaths>("Core/Paths");

export namespace Paths {
    export type Interface = IPaths;
    export type DownloadFormat = IDownloadFormat;
    export type DataFilePathOptions = IDataFilePathOptions;
}
