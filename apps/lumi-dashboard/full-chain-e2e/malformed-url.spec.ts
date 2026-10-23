import { expect, test } from "@playwright/test";

const DASHBOARD_URL = process.env.LUMI_DASHBOARD_URL ?? "http://127.0.0.1:3000";

/**
 * The production build (node .output/server/index.mjs) with nitro
 * 3.0.1-alpha.2 never answered a path with invalid percent-encoding: h3 threw
 * an uncaught URIError. e2e/malformed-url.spec.ts covers the dev server, which
 * answered 500, so this one runs against the built image.
 */
test.describe("Malformed percent-encoding against the production build", () => {
  for (const path of [
    "/%FF",
    "/feedback%C0%AF",
    "/_serverFn/%FF",
    "/api/internal/isAlive%E0",
  ]) {
    test(`${path} gets 400 without hanging`, async ({ request }) => {
      const response = await request.get(`${DASHBOARD_URL}${path}`, {
        timeout: 5000,
      });

      expect(response.status()).toBe(400);
    });
  }
});
