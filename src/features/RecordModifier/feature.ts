import { createFeature } from "~/base/index.ts";
import { RecordModifier } from "./RecordModifier.ts";

export const RecordModifierFeature = createFeature({
    name: "Upload/RecordModifierFeature",
    register(container) {
        container.register(RecordModifier).inSingletonScope();
    }
});
