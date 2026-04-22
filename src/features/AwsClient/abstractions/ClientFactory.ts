import { createAbstraction } from "~/base/index.ts";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Config } from "~/features/Config/index.ts";

export interface IClientFactory {
    create(table: Config.ResolvedTable): DynamoDBDocumentClient;
}

export const ClientFactory = createAbstraction<IClientFactory>("Aws/ClientFactory");

export namespace ClientFactory {
    export type Interface = IClientFactory;
    export type Client = DynamoDBDocumentClient;
}
