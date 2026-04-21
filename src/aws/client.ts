import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { ResolvedTable } from "../config/define.js";

export type Client = ReturnType<typeof DynamoDBDocumentClient.from>;

export const createClient = (table: ResolvedTable): Client =>
    DynamoDBDocumentClient.from(
        new DynamoDBClient({
            region: table.region,
            credentials: fromNodeProviderChain({ profile: table.awsProfile })
        })
    );
