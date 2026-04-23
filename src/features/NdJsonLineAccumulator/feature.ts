import { createFeature } from "~/base/index.ts";
import { NdJsonLineAccumulator } from "./NdJsonLineAccumulator.ts";

export const NdJsonLineAccumulatorFeature = createFeature({
    name: "Upload/NdJsonLineAccumulatorFeature",
    register(container) {
        container.register(NdJsonLineAccumulator).inSingletonScope();
    }
});
