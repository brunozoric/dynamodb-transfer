import { select } from "@inquirer/prompts";
import type { Config } from "~/features/Config/index.ts";

export const promptTable = (
    tables: Config.ResolvedTable[],
    message: string
): Promise<Config.ResolvedTable> =>
    select<Config.ResolvedTable>({
        message,
        choices: tables.map(table => ({
            name: `${table.description} — ${table.name} (${table.region}, profile: ${table.awsProfile})`,
            value: table
        }))
    });
