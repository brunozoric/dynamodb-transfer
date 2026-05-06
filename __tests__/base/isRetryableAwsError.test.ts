import { describe, it, expect } from "vitest";
import { isRetryableAwsError } from "~/base/index.ts";

describe("isRetryableAwsError", () => {
    it("returns true when error has no .code and error.name is a retryable code", () => {
        const error = new Error("provisioned throughput exceeded");
        error.name = "ProvisionedThroughputExceededException";
        expect(isRetryableAwsError(error)).toBe(true);
    });

    it("returns true when error message contains ECONNRESET", () => {
        expect(isRetryableAwsError(new Error("ECONNRESET"))).toBe(true);
    });

    it("returns true when error message contains ETIMEDOUT", () => {
        expect(isRetryableAwsError(new Error("connection ETIMEDOUT"))).toBe(true);
    });

    it("returns false for a non-Error value", () => {
        expect(isRetryableAwsError("ProvisionedThroughputExceededException")).toBe(false);
    });

    it("returns false for an unrelated Error", () => {
        expect(isRetryableAwsError(new Error("something unrelated"))).toBe(false);
    });
});
