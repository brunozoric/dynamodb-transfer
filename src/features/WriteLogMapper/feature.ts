import { createFeature } from "~/base/index.ts";
import { WriteLogMapper } from "./WriteLogMapper.ts";

export const WriteLogMapperFeature = createFeature({
    name: "Upload/WriteLogMapperFeature",
    register(container) {
        container.register(WriteLogMapper).inSingletonScope();
    }
});
