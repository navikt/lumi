import { describe, expect, it, vi } from "vitest";

import cacheOnlyAssetFiles from "../cacheOnlyAssetFiles";

type NitroApp = Parameters<typeof cacheOnlyAssetFiles>[0];
type ResponseHook = (response: Response, event: { url: URL }) => void;

const IMMUTABLE = "public, max-age=31536000, immutable";

function registerHook(): ResponseHook {
  let responseHook: ResponseHook | undefined;
  const hook = vi.fn((name: string, fn: ResponseHook) => {
    if (name === "response") responseHook = fn;
    return () => {};
  });
  cacheOnlyAssetFiles({
    fetch: vi.fn(),
    hooks: { hook },
  } as unknown as NitroApp);
  if (!responseHook) throw new Error("No response hook registered");
  return responseHook;
}

function cacheControlAfterHook(path: string, status: number): string | null {
  const response = new Response(status === 304 ? null : "body", {
    status,
    headers: { "cache-control": IMMUTABLE },
  });
  registerHook()(response, { url: new URL(path, "http://localhost") });
  return response.headers.get("cache-control");
}

describe("cacheOnlyAssetFiles", () => {
  it("keeps the year-long cache for files that are served", () => {
    expect(cacheControlAfterHook("/assets/index-abc123.js", 200)).toBe(
      IMMUTABLE,
    );
    expect(cacheControlAfterHook("/assets/index-abc123.js", 304)).toBe(
      IMMUTABLE,
    );
  });

  it("stops caching 404s and redirects under /assets", () => {
    expect(cacheControlAfterHook("/assets/finnes-ikke.js", 404)).toBe(
      "private, no-store",
    );
    expect(cacheControlAfterHook("/assets/", 307)).toBe("private, no-store");
    expect(cacheControlAfterHook("/assets", 404)).toBe("private, no-store");
  });

  it("leaves responses outside /assets alone", () => {
    expect(cacheControlAfterHook("/feedback", 404)).toBe(IMMUTABLE);
    expect(cacheControlAfterHook("/assetsx/a.js", 404)).toBe(IMMUTABLE);
  });
});
