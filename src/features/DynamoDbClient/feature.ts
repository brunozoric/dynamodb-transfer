import { createFeature } from "~/base/index.ts";
import { DynamoDbClientFactory } from "./DynamoDbClientFactory.ts";

export const DynamoDbClientFeature = createFeature({
    name: "Core/DynamoDbClientFeature",
    register(container) {
        container.register(DynamoDbClientFactory).inSingletonScope();
    }
});
