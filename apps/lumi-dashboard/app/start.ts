import {
  createCsrfMiddleware,
  createMiddleware,
  createServerOnlyFn,
  createStart,
} from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { logger } from "~/server/logger";
import {
  applyBaselineSecurityHeaders,
  buildCspHeaderValue,
} from "~/server/securityHeaders";
import { reportServerFnFailure } from "~/server/serverFnFailures";
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
    // Pages and server function responses carry data for one signed-in user.
    // no-store also keeps the back/forward cache from restoring such a page
    // after logout. Static assets are served by Nitro outside Start and keep
    // their own caching.
    securityHeaders.set("Cache-Control", "private, no-store");

    // Start applies these to every response that leaves the middleware chain,
    // including redirects and the responses it builds from thrown errors.
    setResponseHeaders(securityHeaders);

    return next({
      context: {
        ...(context ?? {}),
        cspNonce: nonce,
        // Start's own decision, made on the normalized path. Server functions
        // that a page runs in-process during SSR see the page's context, so
        // the flag is false for them. Read it with isServerFnHttpCall().
        serverFnHttpCall: handlerType === "serverFn",
      },
    });
  },
);

const SEC_FETCH_SITE_TOKENS = [
  "same-origin",
  "same-site",
  "cross-site",
  "none",
];

// Logs no header values apart from a valid Sec-Fetch-Site token.
const logCsrfRejection = createServerOnlyFn(
  (request: Request, path: string) => {
    const secFetchSite = request.headers.get("sec-fetch-site");
    logger.warn(
      {
        method: request.method,
        path,
        secFetchSite:
          secFetchSite && SEC_FETCH_SITE_TOKENS.includes(secFetchSite)
            ? secFetchSite
            : undefined,
        hasOrigin: request.headers.has("origin"),
        hasReferer: request.headers.has("referer"),
      },
      "Rejected server function request due to CSRF validation failure",
    );
  },
);

// Start adds this middleware on its own only when an app has no start.ts.
// It checks every server function request over HTTP, GET included. When
// Sec-Fetch-Site is present it decides alone, and only same-origin passes.
// Without it, Origin must equal the origin of the request URL; without
// Origin, Referer must be on that origin. Requests with none of them get 403.
// Unlike the Origin check in authMiddleware, it also runs in mock mode and in
// the public demo. Server functions called during SSR never reach it.
// Start's compiler leaves these options in the client code, so server-only
// code in them must go through createServerOnlyFn.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  failureResponse: ({ request, pathname }) => {
    logCsrfRejection(request, pathname);
    return new Response("Forbidden", { status: 403 });
  },
});

// Without this, a server function that throws answers 200 and logs nothing:
// Start serializes the error and sets no status. It runs outside every
// server function's own middleware, so failures in authMiddleware and in
// input validation pass through it too. The error itself reaches the caller
// unchanged.
const serverFnFailureMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    const startedAt = performance.now();
    try {
      return await next();
    } catch (error) {
      try {
        reportServerFnFailure(error, {
          serverFn: serverFnMeta.name,
          durationMs: performance.now() - startedAt,
        });
      } catch {
        // Logging or metrics must never replace the server function's error.
      }
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorSerializationAdapter],
  // Security headers first, so CSRF rejections carry them too.
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
  functionMiddleware: [serverFnFailureMiddleware],
}));
