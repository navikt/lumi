import { expect, test } from "@playwright/test";

const isServerFunction = (url: string) => url.includes("/_serverFn/");

test.describe("CSRF protection for server functions", () => {
  test("only same-origin calls reach a server function", async ({
    page,
    request,
  }) => {
    // Replay a real call from the page, with its server function id and payload.
    const serverFunctionCall = page.waitForRequest(
      (call) => call.method() === "GET" && isServerFunction(call.url()),
    );
    await page.goto("/");
    const url = (await serverFunctionCall).url();

    await test.step("Sec-Fetch-Site: same-origin is accepted", async () => {
      const response = await request.get(url, {
        headers: { "Sec-Fetch-Site": "same-origin" },
      });
      expect(response.status()).toBe(200);
    });

    for (const [name, headers] of [
      ["Sec-Fetch-Site: cross-site", { "Sec-Fetch-Site": "cross-site" }],
      ["Sec-Fetch-Site: same-site", { "Sec-Fetch-Site": "same-site" }],
      ["no Sec-Fetch-Site, Origin or Referer", {}],
    ] as const) {
      await test.step(`${name} is rejected with the security headers`, async () => {
        const response = await request.get(url, { headers });
        expect(response.status()).toBe(403);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["content-security-policy"]).toContain(
          "frame-ancestors 'none'",
        );
      });
    }
  });

  test("an https Origin behind the ingress passes without Sec-Fetch-Site", async ({
    page,
    request,
  }) => {
    const serverFunctionCall = page.waitForRequest(
      (call) => call.method() === "GET" && isServerFunction(call.url()),
    );
    await page.goto("/");
    const url = (await serverFunctionCall).url();
    // TLS ends at the ingress, so the server gets http and X-Forwarded-Proto.
    const httpsOrigin = new URL(url).origin.replace(/^http:/, "https:");
    const behindIngress = { "X-Forwarded-Proto": "https" };

    for (const [name, headers, status] of [
      [
        "Origin on the https origin",
        { ...behindIngress, Origin: httpsOrigin },
        200,
      ],
      [
        "Referer on the https origin",
        { ...behindIngress, Referer: `${httpsOrigin}/feedback` },
        200,
      ],
      [
        "Origin on another site",
        { ...behindIngress, Origin: "https://evil.example" },
        403,
      ],
    ] as const) {
      await test.step(`${name} gives ${status}`, async () => {
        const response = await request.get(url, { headers });
        expect(response.status()).toBe(status);
      });
    }
  });
});
