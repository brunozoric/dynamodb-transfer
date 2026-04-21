import { defineConfig } from "./src/config/define.js";

export default defineConfig({
  defaults: {
    awsProfile: "default",
    region: "eu-central-1",
  },
  tables: [
    // `description` is shown in the selection prompt and also drives the
    // exported filename (camelCased). Must be unique, non-empty, and ≤ 25
    // characters. `name` is the real DynamoDB table name.
    { name: "my-table", description: "Production" },

    // Per-table awsProfile/region are optional; omit to inherit defaults.
    // { name: "staging-table", description: "Staging", awsProfile: "stage", region: "us-east-1" },
  ],
});
