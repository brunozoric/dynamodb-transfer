import { select } from "@inquirer/prompts";

export type Action = "download" | "send" | "exit";

export const promptAction = (): Promise<Action> =>
  select<Action>({
    message: "What would you like to do?",
    choices: [
      { name: "Download a table", value: "download" },
      { name: "Send a file to a table", value: "send" },
      { name: "Exit", value: "exit" },
    ],
  });
