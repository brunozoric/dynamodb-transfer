import { createAbstraction } from "~/base/index.ts";
import type { Config } from "~/features/Config/index.ts";
import type { IDynamoDbClient } from "./DynamoDbClient.ts";

export interface IDynamoDbClientFactory {
    create(table: Config.ResolvedTable): IDynamoDbClient;
}

export const DynamoDbClientFactory = createAbstraction<IDynamoDbClientFactory>(
    "Core/DynamoDbClientFactory"
);

export namespace DynamoDbClientFactory {
    export type Interface = IDynamoDbClientFactory;
}
