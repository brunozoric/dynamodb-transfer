import { createFeature } from "~/base/index.ts";
import { Upload } from "./Upload.ts";

export const UploadFeature = createFeature({
    name: "Commands/UploadFeature",
    register(container) {
        container.register(Upload).inSingletonScope();
    }
});
