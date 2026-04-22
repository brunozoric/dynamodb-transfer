import { select } from "@inquirer/prompts";

export type Action = "download" | "upload" | "exit";

export const promptAction = (): Promise<Action> =>
    select<Action>({
        message: "What would you like to do?",
        choices: [
            { name: "Download a table", value: "download" },
            { name: "Upload a file to a table", value: "upload" },
            { name: "Exit", value: "exit" }
        ]
    });
