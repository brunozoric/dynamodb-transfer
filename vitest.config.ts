import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    test: {
        globalSetup: ["./__tests__/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.d.ts"]
        }
    }
});
