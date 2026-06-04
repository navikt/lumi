import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOboTokenCacheForTesting,
  getCachedAzureOboToken,
  getJwtExpiresAtMs,
} from "../auth";

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("OBO token cache", () => {
  beforeEach(() => {
    clearOboTokenCacheForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads JWT expiry from exp claim", () => {
    expect(getJwtExpiresAtMs(jwt({ exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    );
  });

  it("caches a non-expired OBO token", async () => {
    const token = jwt({ sub: "user" });
    const oboToken = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const requestAzureOboToken = vi.fn(async () => ({
      ok: true as const,
      token: oboToken,
    }));

    await expect(
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
    ).resolves.toBe(oboToken);
    await expect(
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
    ).resolves.toBe(oboToken);

    expect(requestAzureOboToken).toHaveBeenCalledTimes(1);
  });

  it("refreshes a cached OBO token that is inside the expiry skew", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T00:00:00Z"));

    const token = jwt({ sub: "user" });
    const expiringOboToken = jwt({
      exp: Math.floor(Date.now() / 1000) + 30,
    });
    const freshOboToken = jwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const requestAzureOboToken = vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, token: expiringOboToken })
      .mockResolvedValueOnce({ ok: true as const, token: freshOboToken });

    await expect(
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
    ).resolves.toBe(expiringOboToken);
    await expect(
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
    ).resolves.toBe(freshOboToken);

    expect(requestAzureOboToken).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent OBO token requests", async () => {
    const token = jwt({ sub: "user" });
    const oboToken = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const requestAzureOboToken = vi.fn(
      () =>
        new Promise<{ ok: true; token: string }>((resolve) => {
          setTimeout(() => resolve({ ok: true, token: oboToken }), 10);
        }),
    );

    const results = await Promise.all([
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
      getCachedAzureOboToken(token, "audience", requestAzureOboToken),
    ]);

    expect(results).toEqual([oboToken, oboToken, oboToken]);
    expect(requestAzureOboToken).toHaveBeenCalledTimes(1);
  });
});
