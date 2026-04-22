import { createFeature } from "~/base/index.ts";
import { Config } from "./Config.ts";

export const ConfigFeature = createFeature({
    name: "Config/ConfigFeature",
    register(container) {
        container.register(Config).inSingletonScope();
    }
});
