import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const { randomBytes } = await import("node:crypto");
    const nonce = randomBytes(16).toString("base64");

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
        isDev: process.env.NODE_ENV !== "production",
        nonce,
      }),
    );

    return result;
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
