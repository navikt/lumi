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

  describe("behind TLS termination", () => {
    // The pod gets plain HTTP; the ingress sets X-Forwarded-Proto.
    function forwardedPost(headers: Record<string, string>) {
      return new Request("http://lumi.nav.no/server-fn", {
        method: "POST",
        headers: { "x-forwarded-proto": "https", ...headers },
      });
    }

    it("accepts a POST from the page's own https origin", () => {
      expect(() =>
        validateCsrfHeaders(forwardedPost({ origin: "https://lumi.nav.no" })),
      ).not.toThrow();
      expect(() =>
        validateCsrfHeaders(
          forwardedPost({ referer: "https://lumi.nav.no/dashboard" }),
        ),
      ).not.toThrow();
    });

    it("rejects a POST from another origin", () => {
      expect(() =>
        validateCsrfHeaders(forwardedPost({ origin: "https://evil.example" })),
      ).toThrow("Forbidden: Cross-origin request");
    });

    it("needs X-Forwarded-Proto to treat the request as https", () => {
      const request = new Request("http://lumi.nav.no/server-fn", {
        method: "POST",
        headers: { origin: "https://lumi.nav.no" },
      });

      expect(() => validateCsrfHeaders(request)).toThrow(
        "Forbidden: Cross-origin request",
      );
    });
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
