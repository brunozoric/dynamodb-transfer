import { ConfigSchema } from "./define.js";
import type { ResolvedTable } from "./define.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(`config.ts: ${message}`);
    this.name = "ConfigError";
  }
}

const formatIssue = (issue: {
  path: (string | number | symbol)[];
  message: string;
}): string => {
  const path = issue.path.map(String).join(".");
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
};

const importUserConfig = async (): Promise<unknown> => {
  try {
    const mod = await import("../../config.js");
    return mod.default;
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      err.code === "ERR_MODULE_NOT_FOUND"
    ) {
      throw new ConfigError(
        "file not found. Copy config.example.ts to config.ts and edit."
      );
    }
    throw err;
  }
};

export const loadConfig = async (): Promise<ResolvedTable[]> => {
  const userConfig = await importUserConfig();
  const parsed = ConfigSchema.safeParse(userConfig);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ConfigError(first ? formatIssue(first) : "invalid config");
  }
  const { defaults, tables } = parsed.data;
  return tables.map((table) => ({
    name: table.name,
    description: table.description,
    writable: table.writable,
    awsProfile: table.awsProfile ?? defaults.awsProfile,
    region: table.region ?? defaults.region,
  }));
};
