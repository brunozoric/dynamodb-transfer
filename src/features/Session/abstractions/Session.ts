import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { Paths } from "~/features/Paths/index.ts";

export type ISessionAction = "download" | "upload" | "exit";

export interface ISessionData {
    action: ISessionAction;
    table: Config.ResolvedTable;
    segments: number;
    format: Paths.DownloadFormat | null;
    destPath: string | null;
    sourcePath: string | null;
    startFrom: number;
    logLevel: string;
    logToFile: boolean;
}

export interface ISession {
    set<K extends keyof ISessionData>(key: K, value: ISessionData[K]): void;
    get<K extends keyof ISessionData>(key: K): ISessionData[K] | undefined;
    snapshot(): Readonly<Partial<ISessionData>>;
}

export const Session = createAbstraction<ISession>("Core/Session");

export namespace Session {
    export type Interface = ISession;
    export type Data = ISessionData;
    export type Action = ISessionAction;
}
