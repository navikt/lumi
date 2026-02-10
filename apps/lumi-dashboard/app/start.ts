import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const { randomBytes } = await import("node:crypto");
    const nonce = randomBytes(16).toString("base64");
    const isDev = process.env.NODE_ENV !== "production";
    const enableStrictCspReportOnly =
      process.env.ENABLE_STRICT_CSP_REPORT_ONLY === "true";

    const result = await next({
      context: {
        ...(context ?? {}),
        cspNonce: nonce,
      },
    });

    applyBaselineSecurityHeaders(result.response.headers);
    result.response.headers.set(
      "Content-Security-Policy",
      buildCspHeaderValue({
        isDev,
        nonce,
      }),
    );

    if (enableStrictCspReportOnly) {
      result.response.headers.set(
        "Content-Security-Policy-Report-Only",
        buildCspHeaderValue({
          isDev,
          nonce,
          strictStyleMode: true,
        }),
      );
    } else {
      result.response.headers.delete("Content-Security-Policy-Report-Only");
    }

    return result;
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
