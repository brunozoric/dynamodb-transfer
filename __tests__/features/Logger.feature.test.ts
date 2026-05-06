import { describe, it, expect } from "vitest";
import { readLoggerParamsFromEnv } from "~/features/Logger/feature.ts";

describe("readLoggerParamsFromEnv", () => {
  it('accepts log level "debug"', () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "debug" })).toEqual({
      logLevel: "debug",
      json: false
    });
  });

  it('accepts log level "info"', () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "info" })).toEqual({
      logLevel: "info",
      json: false
    });
  });

  it('accepts log level "warn"', () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "warn" })).toEqual({
      logLevel: "warn",
      json: false
    });
  });

  it('accepts log level "error"', () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "error" })).toEqual({
      logLevel: "error",
      json: false
    });
  });

  it('accepts log level "silent"', () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "silent" })).toEqual({
      logLevel: "silent",
      json: false
    });
  });

  it("falls back to info for an invalid LOG_LEVEL", () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "INVALID" })).toEqual({
      logLevel: "info",
      json: false
    });
  });

  it("falls back to info when LOG_LEVEL is absent", () => {
    expect(readLoggerParamsFromEnv({})).toEqual({ logLevel: "info", json: false });
  });

  it("sets json: true when LOG_FORMAT=json", () => {
    expect(readLoggerParamsFromEnv({ LOG_FORMAT: "json" })).toEqual({
      logLevel: "info",
      json: true
    });
  });

  it("combines a valid log level with LOG_FORMAT=json", () => {
    expect(readLoggerParamsFromEnv({ LOG_LEVEL: "debug", LOG_FORMAT: "json" })).toEqual({
      logLevel: "debug",
      json: true
    });
  });
});
