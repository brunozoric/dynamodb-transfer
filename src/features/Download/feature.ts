import { createFeature } from "~/base/index.ts";
import { Download } from "./Download.ts";

export const DownloadFeature = createFeature({
    name: "Commands/DownloadFeature",
    register(container) {
        container.register(Download).inSingletonScope();
    }
});
