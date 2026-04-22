import { createFeature } from "~/base/index.ts";
import { ClientFactory } from "./ClientFactory.ts";

export const AwsClientFeature = createFeature({
    name: "Aws/AwsClientFeature",
    register(container) {
        container.register(ClientFactory).inSingletonScope();
    }
});
