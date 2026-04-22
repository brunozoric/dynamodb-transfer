import { createFeature } from "~/base/index.ts";
import { Logger } from "./Logger.ts";

export const LoggerFeature = createFeature({
    name: "Core/LoggerFeature",
    register(container) {
        container.register(Logger).inSingletonScope();
    }
});
