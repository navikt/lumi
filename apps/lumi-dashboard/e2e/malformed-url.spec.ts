import { expect, test } from "@playwright/test";

/**
 * A path with invalid percent-encoding made h3 2.0.1-rc.20 throw before it
 * answered, so the request hung until the client gave up. The server must
 * refuse it at once instead.
 */
test.describe("Malformed percent-encoding in the path", () => {
  for (const path of [
    "/%FF",
    "/feedback%C0%AF",
    "/_serverFn/%FF",
    "/api/internal/isAlive%E0",
  ]) {
    test(`${path} gets 400 without hanging`, async ({ request }) => {
      const response = await request.get(path, { timeout: 5000 });

      expect(response.status()).toBe(400);
    });
  }
});
