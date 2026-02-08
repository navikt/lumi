import { describe, expect, it } from "vitest";

import { validateCsrfHeaders } from "~/server/middleware/auth";

describe("authMiddleware CSRF validation", () => {
  it("rejects POST requests with mismatching Origin", () => {
    const request = new Request("https://lumi.nav.no/server-fn", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(() => validateCsrfHeaders(request)).toThrow(
      "Forbidden: Cross-origin request",
    );
  });

  it("accepts POST requests with matching Referer when Origin is missing", () => {
    const request = new Request("https://lumi.nav.no/server-fn", {
      method: "POST",
      headers: {
        referer: "https://lumi.nav.no/dashboard",
      },
    });

    expect(() => validateCsrfHeaders(request)).not.toThrow();
  });

  it("rejects POST requests when both Origin and Referer are missing", () => {
    const request = new Request("https://lumi.nav.no/server-fn", {
      method: "POST",
    });

    expect(() => validateCsrfHeaders(request)).toThrow(
      "Forbidden: Missing CSRF headers",
    );
  });

  it("does not enforce CSRF checks for GET", () => {
    const request = new Request("https://lumi.nav.no/server-fn", {
      method: "GET",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(() => validateCsrfHeaders(request)).not.toThrow();
  });
});
