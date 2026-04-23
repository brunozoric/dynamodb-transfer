import { createFeature } from "~/base/index.ts";
import { ParseNdJsonErrorHandler } from "./ParseNdJsonErrorHandler.ts";

export const ParseNdJsonErrorHandlerFeature = createFeature({
    name: "Upload/ParseNdJsonErrorHandlerFeature",
    register(container) {
        container.register(ParseNdJsonErrorHandler).inSingletonScope();
    }
});
