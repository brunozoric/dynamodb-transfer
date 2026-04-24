import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromEnv, fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import type { Config } from "~/features/Config/index.ts";
import type { Logger } from "~/features/Logger/index.ts";
import { Logger as LoggerAbstraction } from "~/features/Logger/index.ts";
import type { WriteLogMapper } from "~/features/WriteLogMapper/index.ts";
import { WriteLogMapper as WriteLogMapperAbstraction } from "~/features/WriteLogMapper/index.ts";
import { DynamoDbClientFactory as DynamoDbClientFactoryAbstraction } from "./abstractions/DynamoDbClientFactory.ts";
import { DynamoDbClientImpl } from "./DynamoDbClient.ts";

function resolveCredentials(awsProfile: string): AwsCredentialIdentityProvider {
    if (process.env.AWS_ENDPOINT_URL_DYNAMODB !== undefined) {
        return fromEnv();
    }
    return fromNodeProviderChain({ profile: awsProfile });
}

class DynamoDbClientFactoryImpl implements DynamoDbClientFactoryAbstraction.Interface {
    public constructor(
        private readonly logger: Logger.Interface,
        private readonly writeLogMapper: WriteLogMapper.Interface
    ) {}

    public create(table: Config.ResolvedTable): DynamoDbClientImpl {
        const documentClient = DynamoDBDocumentClient.from(
            new DynamoDBClient({
                region: table.region,
                credentials: resolveCredentials(table.awsProfile)
            })
        );
        return new DynamoDbClientImpl(documentClient, this.logger, this.writeLogMapper);
    }
}

export const DynamoDbClientFactory = DynamoDbClientFactoryAbstraction.createImplementation({
    implementation: DynamoDbClientFactoryImpl,
    dependencies: [LoggerAbstraction, WriteLogMapperAbstraction]
});
