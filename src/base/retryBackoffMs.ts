export function retryBackoffMs(attempt: number, initialMs: number): number {
    const base = initialMs * Math.pow(2, attempt);
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
}
