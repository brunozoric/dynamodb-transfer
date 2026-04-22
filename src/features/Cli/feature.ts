import { createFeature } from "~/base/index.ts";
import { Cli } from "./Cli.ts";

export const CliFeature = createFeature({
    name: "App/CliFeature",
    register(container) {
        container.register(Cli).inSingletonScope();
    }
});
