import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorageAdapter } from "../storageAdapters.js";

describe("getStorageAdapter", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists values with the localStorage strategy", async () => {
    const adapter = getStorageAdapter("localStorage");

    await expect(adapter.write("lumi-test", "dismissed")).resolves.toEqual({
      persisted: true,
      allowed: true,
    });
    await expect(adapter.read("lumi-test")).resolves.toBe("dismissed");

    await adapter.remove("lumi-test");

    await expect(adapter.read("lumi-test")).resolves.toBeNull();
  });

  it("accepts writes without persisting with the none strategy", async () => {
    const adapter = getStorageAdapter("none");

    await expect(adapter.write("lumi-test", "dismissed")).resolves.toEqual({
      persisted: false,
      allowed: true,
    });
    await expect(adapter.read("lumi-test")).resolves.toBeNull();
    await expect(adapter.remove("lumi-test")).resolves.toBeUndefined();
  });

  it("persists allowed values with the consent strategy", async () => {
    const adapter = getStorageAdapter("consent");

    await expect(adapter.write("lumi-test", "dismissed")).resolves.toEqual({
      persisted: true,
      allowed: true,
    });
    await expect(adapter.read("lumi-test")).resolves.toBe("dismissed");

    await adapter.remove("lumi-test");

    await expect(adapter.read("lumi-test")).resolves.toBeNull();
  });

  it("does not access browser storage during server rendering", async () => {
    const adapter = getStorageAdapter("localStorage");
    vi.stubGlobal("window", undefined);

    await expect(adapter.read("lumi-test")).resolves.toBeNull();
    await expect(adapter.write("lumi-test", "dismissed")).resolves.toEqual({
      persisted: false,
      allowed: false,
    });
    await expect(adapter.remove("lumi-test")).resolves.toBeUndefined();
  });

  it("reports localStorage quota errors without throwing", async () => {
    const adapter = getStorageAdapter("localStorage");
    const quotaError = new DOMException(
      "The quota has been exceeded",
      "QuotaExceededError",
    );
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw quotaError;
    });

    await expect(adapter.write("lumi-test", "dismissed")).resolves.toEqual({
      persisted: false,
      allowed: false,
      error: quotaError,
    });
  });
});
