import { createAbstraction } from "~/base/index.ts";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config } from "~/features/Config/index.ts";

export const ClientFactory = createAbstraction<ClientFactory.Interface>("Aws/ClientFactory");

export namespace ClientFactory {
    export interface Interface {
        create(table: Config.ResolvedTable): Client;
    }
    export type Client = DynamoDBDocumentClient;
}
