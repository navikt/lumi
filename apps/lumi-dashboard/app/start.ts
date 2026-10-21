import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";
import { logServerFnError } from "~/server/serverFnErrors";
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

const serverFnErrorLoggingMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next, serverFnMeta }) => {
  try {
    return await next();
  } catch (error) {
    logServerFnError(error, serverFnMeta.name);
    throw error;
  }
});

export const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorSerializationAdapter],
  requestMiddleware: [securityHeadersMiddleware],
  functionMiddleware: [serverFnErrorLoggingMiddleware],
}));
