import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";
import { apiErrorSerializationAdapter } from "~/utils/apiErrorSerialization";

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const { randomBytes } = await import("node:crypto");
    const nonce = randomBytes(16).toString("base64");
    const isDev = process.env.NODE_ENV !== "production";

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

    return result;
  },
);

export const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorSerializationAdapter],
  requestMiddleware: [securityHeadersMiddleware],
}));
