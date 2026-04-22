import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromEnv, fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import type { Config } from "~/features/Config/index.ts";
import { ClientFactory as ClientFactoryAbstraction } from "./abstractions/index.ts";

function buildCredentialProvider(awsProfile: string): AwsCredentialIdentityProvider {
    if (process.env.AWS_ENDPOINT_URL_DYNAMODB !== undefined) {
        return fromEnv();
    }
    return fromNodeProviderChain({ profile: awsProfile });
}

class ClientFactoryImpl implements ClientFactoryAbstraction.Interface {
    public create(table: Config.ResolvedTable): ClientFactoryAbstraction.Client {
        return DynamoDBDocumentClient.from(
            new DynamoDBClient({
                region: table.region,
                credentials: buildCredentialProvider(table.awsProfile)
            })
        );
    }
}

export const ClientFactory = ClientFactoryAbstraction.createImplementation({
    implementation: ClientFactoryImpl,
    dependencies: []
});
