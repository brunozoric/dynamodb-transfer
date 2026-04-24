import { defineConfig } from "~/index.ts";

export default defineConfig(async ({ container }) => {
  // Register custom services here. Example:
  // import { ParseNdJsonErrorHandler } from "./src/index.js";
  // container.registerInstance(ParseNdJsonErrorHandler, new MyHandler());

  return {
    defaults: {
      awsProfile: "default",
      region: "eu-central-1"
    },
    tables: [
      // `description` is shown in the selection prompt and also drives the
      // exported filename (camelCased). Must be unique, non-empty, and ≤ 40
      // characters. `name` is the real DynamoDB table name. `writable` MUST
      // be set explicitly — tables with `writable: false` never appear in
      // the Upload destination list, so accidental writes to the wrong
      // table are impossible.
      { name: "my-table", description: "Production", writable: false as const }

      // Per-table awsProfile/region are optional; omit to inherit defaults.
      // Flip `writable: true` only on tables you intentionally want to be
      // restore targets.
      // { name: "staging-table", description: "Staging", writable: true, awsProfile: "stage", region: "us-east-1" },
    ]
  };
});
