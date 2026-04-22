import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";

export type IAction = "download" | "upload" | "exit";

export interface IPrompter {
    action(): Promise<IAction>;
    table(options: ITableOptions): Promise<Config.ResolvedTable>;
    downloadFormat(options: IDownloadFormatOptions): Promise<Paths.DownloadFormat>;
    segments(): Promise<number>;
    sourceFile(): Promise<string | null>;
    destPath(options: IDestPathOptions): Promise<string | null>;
    confirmUpload(options: IConfirmUploadOptions): Promise<void>;
    logToFile(): Promise<boolean>;
}

export interface ITableOptions {
    tables: Config.ResolvedTable[];
    message: string;
}

export interface IDownloadFormatOptions {
    segments: number;
}

export interface IDestPathOptions {
    initialPath: string;
    extension: string;
}

export interface IConfirmUploadOptions {
    sourcePath: string;
    table: Config.ResolvedTable;
}

export const Prompter = createAbstraction<IPrompter>("Ui/Prompter");

export namespace Prompter {
    export type Interface = IPrompter;
    export type Action = IAction;
    export type TableOptions = ITableOptions;
    export type DownloadFormatOptions = IDownloadFormatOptions;
    export type DestPathOptions = IDestPathOptions;
    export type ConfirmUploadOptions = IConfirmUploadOptions;
}
