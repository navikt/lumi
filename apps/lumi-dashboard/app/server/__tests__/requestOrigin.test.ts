import { describe, expect, it } from "vitest";

import { getExpectedOrigin } from "../requestOrigin";

describe("getExpectedOrigin", () => {
  it("takes https from X-Forwarded-Proto when TLS ends in front of the pod", () => {
    const request = new Request("http://lumi.nav.no/_serverFn/abc", {
      headers: { "x-forwarded-proto": "https" },
    });

    expect(getExpectedOrigin(request)).toBe("https://lumi.nav.no");
  });

  it("keeps the scheme of the request URL otherwise", () => {
    expect(getExpectedOrigin(new Request("http://localhost:3000/x"))).toBe(
      "http://localhost:3000",
    );
    expect(
      getExpectedOrigin(
        new Request("http://localhost:3000/x", {
          headers: { "x-forwarded-proto": "http" },
        }),
      ),
    ).toBe("http://localhost:3000");
  });
});
