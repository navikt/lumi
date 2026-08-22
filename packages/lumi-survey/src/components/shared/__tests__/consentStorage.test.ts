import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("consent storage mutations", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports a missing consent API as a failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__DECORATOR_DATA__", undefined);
    vi.stubGlobal("webStorageController", undefined);
    const { writeConsentValue } = await import("../consentStorage.js");

    const resultPromise = writeConsentValue("lumi-test", "dismissed");
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;
    expect(result.outcome).toBe("failed");
    expect(result).toHaveProperty("error", expect.any(Error));
    expect(result).toHaveProperty(
      "error.message",
      expect.stringMatching(/consent API is unavailable/i),
    );
  });

  it("keeps server-side mutations silent", async () => {
    vi.stubGlobal("window", undefined);
    const { removeConsentValue, writeConsentValue } = await import(
      "../consentStorage.js"
    );

    await expect(writeConsentValue("lumi-test", "dismissed")).resolves.toEqual({
      outcome: "skipped",
    });
    await expect(removeConsentValue("lumi-test")).resolves.toEqual({
      outcome: "skipped",
    });
  });
});
