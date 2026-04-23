const RETRYABLE_ERROR_CODES = new Set([
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "ThrottlingException",
    "TransactionConflictException",
    "ServiceUnavailable",
    "InternalServerError"
]);

export function isRetryableAwsError(error: unknown): boolean {
    if (error instanceof Error) {
        const code = (error as Error & { code?: string }).code ?? error.name;
        if (RETRYABLE_ERROR_CODES.has(code)) {
            return true;
        }
        if (error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT")) {
            return true;
        }
    }
    return false;
}
