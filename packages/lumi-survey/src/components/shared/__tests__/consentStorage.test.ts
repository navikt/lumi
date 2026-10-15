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

  it("warns once per page load when the consent API is missing", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__DECORATOR_DATA__", undefined);
    vi.stubGlobal("webStorageController", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { readConsentValue, writeConsentValue } = await import(
      "../consentStorage.js"
    );

    const reads = Promise.all([
      readConsentValue("lumi-dismissed-a"),
      readConsentValue("lumi-dismissed-b"),
      writeConsentValue("lumi-dismissed-a", "dismissed"),
    ]);
    await vi.advanceTimersByTimeAsync(5000);
    await reads;

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/starts minimized/);
    expect(warn.mock.calls[0]?.[0]).toMatch(
      /storageStrategy to "localStorage"/,
    );
    expect(warn.mock.calls[0]?.[0]).toMatch(/guider\/lagring/);
    warn.mockRestore();
  });

  it("stays silent when the user has declined survey consent", async () => {
    vi.stubGlobal("__DECORATOR_DATA__", { mock: true });
    vi.stubGlobal("webStorageController", {
      // The decorator may refuse keys of a declined category as well.
      isStorageKeyAllowed: () => false,
      getCurrentConsent: () => ({
        consent: { analytics: false, surveys: false },
        userActionTaken: true,
      }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { readConsentValue } = await import("../consentStorage.js");

    await expect(readConsentValue("lumi-dismissed-a")).resolves.toMatchObject({
      outcome: "unavailable",
    });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns when the decorator refuses the key despite survey consent", async () => {
    vi.stubGlobal("__DECORATOR_DATA__", { mock: true });
    vi.stubGlobal("webStorageController", {
      isStorageKeyAllowed: () => false,
      getCurrentConsent: () => ({
        consent: { analytics: true, surveys: true },
        userActionTaken: true,
      }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { readConsentValue } = await import("../consentStorage.js");

    await readConsentValue("lumi-dismissed-a");

    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls[0]?.[0] as string;
    expect(message).toMatch(/lumi-dismissed-a/);
    // The decorator is there, so switching to localStorage is the wrong fix.
    expect(message).toMatch(/#lumi/);
    expect(message).not.toMatch(/localStorage/);
    expect(message).toMatch(/guider\/lagring/);
    warn.mockRestore();
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
