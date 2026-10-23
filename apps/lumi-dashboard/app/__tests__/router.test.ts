import { getGlobalStartContext } from "@tanstack/react-start";
import { describe, expect, it, vi } from "vitest";
import { getRouter } from "~/router";

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    getGlobalStartContext: vi.fn(actual.getGlobalStartContext),
  };
});

describe("getRouter", () => {
  it("uses the CSP nonce from the start context", () => {
    vi.mocked(getGlobalStartContext).mockReturnValueOnce({
      cspNonce: "test-nonce",
      serverFnHttpCall: false,
    });

    expect(getRouter().options.ssr).toEqual({ nonce: "test-nonce" });
  });

  // Start also calls getRouter outside the request context, for example to
  // resolve a redirect from a server function.
  it("creates a router without a nonce outside a request context", () => {
    expect(() => getGlobalStartContext()).toThrow(/No Start context found/);

    expect(() => getRouter()).not.toThrow();
    expect(getRouter().options.ssr).toBeUndefined();
  });
});
