import { describe, expect, it } from "vitest";

import { THEME_INIT_SCRIPT } from "~/config/themeInit";
import { buildCspHeaderValue, sha256Base64 } from "~/server/securityHeaders";

describe("security headers", () => {
  it("builds a CSP with theme-init hash and no unsafe-inline in script-src", () => {
    const csp = buildCspHeaderValue({ isDev: false });
    const expectedHash = sha256Base64(THEME_INIT_SCRIPT);

    expect(csp).toContain(`'sha256-${expectedHash}'`);

    const scriptSrcDirective = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src "));

    expect(scriptSrcDirective).toBeTruthy();
    expect(scriptSrcDirective).not.toContain("'unsafe-inline'");
  });

  it("includes a nonce in script-src when provided", () => {
    const csp = buildCspHeaderValue({ isDev: false, nonce: "test-nonce" });

    const scriptSrcDirective = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src "));

    expect(scriptSrcDirective).toContain("'nonce-test-nonce'");
  });
});
