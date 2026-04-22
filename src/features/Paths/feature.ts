import { createFeature } from "~/base/index.ts";
import { Paths } from "./Paths.ts";

export const PathsFeature = createFeature({
    name: "Core/PathsFeature",
    register(container) {
        container.register(Paths).inSingletonScope();
    }
});
