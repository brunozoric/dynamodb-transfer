import { describe, it, expect } from "vitest";
import { retryBackoffMs } from "~/base/index.ts";

describe("retryBackoffMs", () => {
    it("attempt=0, initialMs=100: result is within [75, 125] and is an integer", () => {
        const result = retryBackoffMs(0, 100);
        expect(result).toBeGreaterThanOrEqual(75);
        expect(result).toBeLessThanOrEqual(125);
        expect(Number.isInteger(result)).toBe(true);
    });

    it("attempt=1, initialMs=100: result is within [150, 250]", () => {
        const result = retryBackoffMs(1, 100);
        expect(result).toBeGreaterThanOrEqual(150);
        expect(result).toBeLessThanOrEqual(250);
    });

    it("attempt=3, initialMs=50: result is within [300, 500]", () => {
        const result = retryBackoffMs(3, 50);
        expect(result).toBeGreaterThanOrEqual(300);
        expect(result).toBeLessThanOrEqual(500);
    });
});
