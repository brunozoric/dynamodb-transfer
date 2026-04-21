import { input } from "@inquirer/prompts";

export const promptSegments = async (): Promise<number> => {
    const raw = await input({
        message: "Number of parallel scan segments (1-16):",
        default: "4",
        validate: value => {
            const trimmed = value.trim();
            if (!/^\d+$/.test(trimmed)) return "Must be a whole number";
            const n = Number(trimmed);
            if (n < 1) return "Must be at least 1";
            if (n > 16) return "Must be 16 or fewer";
            return true;
        }
    });
    return Number(raw.trim());
};
