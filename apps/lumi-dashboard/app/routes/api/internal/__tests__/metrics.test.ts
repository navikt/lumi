import { describe, expect, it } from "vitest";
import { isIngressRequest } from "~/routes/api/internal/metrics";

describe("isIngressRequest", () => {
  it("returns false for internal requests without forwarded headers", () => {
    const request = new Request("http://localhost:3000/api/internal/metrics");
    expect(isIngressRequest(request)).toBe(false);
  });

  it("returns true when request includes x-forwarded-host", () => {
    const request = new Request("http://localhost:3000/api/internal/metrics", {
      headers: {
        "x-forwarded-host": "lumi-dashboard.ansatt.nav.no",
      },
    });
    expect(isIngressRequest(request)).toBe(true);
  });

  it("returns true when request includes x-forwarded-proto", () => {
    const request = new Request("http://localhost:3000/api/internal/metrics", {
      headers: {
        "x-forwarded-proto": "https",
      },
    });
    expect(isIngressRequest(request)).toBe(true);
  });
});
