import { select } from "@inquirer/prompts";
import type { ResolvedTable } from "../config/define.js";

export const promptTable = (
  tables: ResolvedTable[],
  message: string
): Promise<ResolvedTable> =>
  select<ResolvedTable>({
    message,
    choices: tables.map((table) => ({
      name: `${table.description} — ${table.name} (${table.region}, profile: ${table.awsProfile})`,
      value: table,
    })),
  });
