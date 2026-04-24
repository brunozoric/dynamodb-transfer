import pino, { type LevelWithSilentOrString } from "pino";
import { Writable } from "node:stream";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Logger } from "./abstractions/index.ts";

export type LogTransport = "pretty" | "json";

export interface PinoLoggerParams {
    logLevel: LevelWithSilentOrString;
    transport?: LogTransport;
}

type JsonLogType = "debug" | "info" | "warn" | "error" | "fatal" | "done";

const LEVEL_TO_TYPE: Record<number, JsonLogType> = {
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal"
};

const createJsonDestination = (): Writable => {
    return new Writable({
        write(chunk, _enc, cb) {
            try {
                const entry = JSON.parse(chunk.toString()) as {
                    level: number;
                    msg: string;
                    _done?: boolean;
                };
                const type: JsonLogType = entry._done
                    ? "done"
                    : (LEVEL_TO_TYPE[entry.level] ?? "info");
                process.stdout.write(JSON.stringify({ type, message: entry.msg }) + "\n");
            } catch {
                // ignore malformed lines
            }
            cb();
        }
    });
};

export class PinoLogger implements Logger.Interface {
    private readonly logger: pino.Logger;
    private readonly transport: LogTransport | undefined;
    private filePath: string | undefined;

    public constructor(params: PinoLoggerParams) {
        const base = {
            level: params.logLevel
        };
        this.transport = params.transport;

        if (this.transport === "json") {
            this.logger = pino(base, createJsonDestination());
        } else {
            this.logger = pino({
                ...base,
                transport: {
                    target: "pino-pretty",
                    options: {
                        colorize: true,
                        customColors: "fatal:red,error:red,warn:yellow,info:blue,debug:gray",
                        ignore: "pid,hostname,time",
                        messageFormat: "{msg}"
                    }
                }
            });
        }
    }

    public debug(message: string, ...args: unknown[]): void {
        this.logger.debug(message, ...(args as any[]));
        this.teeToFile("debug", message);
    }

    public info(message: string, ...args: unknown[]): void {
        this.logger.info(message, ...(args as any[]));
        this.teeToFile("info", message);
    }

    public warn(message: string, ...args: unknown[]): void {
        this.logger.warn(message, ...(args as any[]));
        this.teeToFile("warn", message);
    }

    public error(message: string, ...args: unknown[]): void {
        this.logger.error(message, ...(args as any[]));
        this.teeToFile("error", message);
    }

    public fatal(message: string, ...args: unknown[]): void {
        this.logger.fatal(message, ...(args as any[]));
        this.teeToFile("fatal", message);
    }

    public done(message: string): void {
        if (this.transport === "json") {
            this.logger.info({ _done: true }, message);
        } else {
            this.logger.info(message);
        }
        this.teeToFile("done", message);
    }

    public setLevel(level: string): void {
        this.logger.level = level;
    }

    public attachFile(path: string): void {
        const dir = dirname(path);
        mkdirSync(dir, { recursive: true });
        this.filePath = path;
    }

    private teeToFile(level: JsonLogType, message: string): void {
        if (this.filePath === undefined) {
            return;
        }
        const ts = new Date().toISOString();
        appendFileSync(this.filePath, `${ts} [${level}] ${message}\n`);
    }
}
