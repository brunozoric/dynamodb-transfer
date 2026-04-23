import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createFeature } from "~/base/index.ts";
import { Logger } from "~/features/Logger/index.ts";
import { DynamoDbClientImpl } from "./DynamoDbClient.ts";
import { SourceDynamoDbClient, TargetDynamoDbClient } from "./abstractions/DynamoDbClient.ts";
import { DynamoDbClientConfig } from "./abstractions/DynamoDbClientConfig.ts";

function buildDocumentClient(conn: DynamoDbClientConfig.Connection): DynamoDBDocumentClient {
    return DynamoDBDocumentClient.from(
        new DynamoDBClient({
            region: conn.region,
            ...(conn.credentials && { credentials: conn.credentials }),
            ...(conn.endpoint && { endpoint: conn.endpoint })
        })
    );
}

export const DynamoDbClientFeature = createFeature({
    name: "Core/DynamoDbClientFeature",
    register(container) {
        const config = container.resolve(DynamoDbClientConfig);
        const logger = container.resolve(Logger);

        container.registerInstance(
            SourceDynamoDbClient,
            new DynamoDbClientImpl(buildDocumentClient(config.source), logger, config.tuning)
        );
        container.registerInstance(
            TargetDynamoDbClient,
            new DynamoDbClientImpl(buildDocumentClient(config.target), logger, config.tuning)
        );
    }
});
