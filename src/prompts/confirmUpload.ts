import { input } from "@inquirer/prompts";
import type { ResolvedTable } from "../config/define.js";

export const confirmUpload = async (sourcePath: string, table: ResolvedTable): Promise<void> => {
    console.log("");
    console.log(
        `About to write ${sourcePath} → ${table.name} (${table.region}, profile: ${table.awsProfile})`
    );
    await input({
        message: `Type the destination table name to confirm (${table.name}), or Ctrl+C to cancel:`,
        validate: value =>
            value.trim() === table.name ||
            `Input does not match "${table.name}". Try again or press Ctrl+C to cancel.`
    });
};
