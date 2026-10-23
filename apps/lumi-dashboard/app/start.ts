import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";
import { apiErrorSerializationAdapter } from "~/utils/apiErrorSerialization";

const securityHeadersMiddleware = createMiddleware().server(
  async ({ next, context, handlerType }) => {
    const { randomBytes } = await import("node:crypto");
    const nonce = randomBytes(16).toString("base64");
    const isDev = process.env.NODE_ENV !== "production";

    const securityHeaders = new Headers();
    applyBaselineSecurityHeaders(securityHeaders);
    securityHeaders.set(
      "Content-Security-Policy",
      buildCspHeaderValue({ isDev, nonce }),
    );
    if (handlerType === "serverFn") {
      // Server function responses carry data for one signed-in user.
      securityHeaders.set("Cache-Control", "private, no-store");
    }

    // Start applies response helpers to every response that leaves the
    // pipeline, including the ones it builds from thrown errors, which never
    // come back through `next()`.
    setResponseHeaders(securityHeaders);

    const result = await next({
      context: {
        ...(context ?? {}),
        cspNonce: nonce,
      },
    });

    for (const [name, value] of securityHeaders) {
      result.response.headers.set(name, value);
    }

    return result;
  },
);

// Start adds this middleware on its own only when an app has no start.ts.
// It checks every server function request over HTTP, GET included. When
// Sec-Fetch-Site is present it decides alone, and only same-origin passes.
// Without it, Origin must equal the origin of the request URL; without
// Origin, Referer must be on that origin. Requests with none of them get 403.
// Unlike the Origin check in authMiddleware, it also runs in mock mode and in
// the public demo. Server functions called during SSR never reach it.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorSerializationAdapter],
  // Security headers first, so CSRF rejections carry them too.
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
