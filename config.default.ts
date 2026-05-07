import { defineConfig } from "~/index.ts";

export default defineConfig(() => ({
  defaults: {
    awsProfile: "default",
    region: "us-east-1"
  },
  tables: [{ name: "example-table", description: "Example Table", writable: false as const }]
}));
