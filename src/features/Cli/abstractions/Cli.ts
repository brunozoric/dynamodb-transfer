import { createAbstraction } from "~/base/index.ts";

export interface ICli {
    run(): Promise<void>;
}

export const Cli = createAbstraction<ICli>("App/Cli");

export namespace Cli {
    export type Interface = ICli;
}
