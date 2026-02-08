import { createMiddleware } from "@tanstack/react-start";

import { logger } from "~/server/logger";
import { isMockMode } from "~/server/utils";
import { serverEnv } from "~/serverEnv";

const BACKEND_URL = serverEnv.LUMI_API_URL || "http://localhost:8080";

const BACKEND_AUDIENCE =
  serverEnv.LUMI_API_AUDIENCE || "api://dev-gcp.team-esyfo.lumi-api/.default";

export interface AuthContext {
  backendUrl: string;
  oboToken: string | null;
}

/**
 * Reusable authentication middleware for server functions.
 *
 * - In NAIS environment: Validates Azure token and exchanges for OBO token
 * - In local dev: Returns null token (mock data mode)
 *
 * Provides AuthContext to downstream handlers with backendUrl and oboToken.
 */

const SAFE_METHODS = new Set(["GET", "HEAD"]);

export function validateCsrfHeaders(
  request: Request,
  options?: { enforceMissingHeaders?: boolean },
): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    if (origin !== expectedOrigin) {
      throw new Error("Forbidden: Cross-origin request");
    }
    return;
  }

  if (referer) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw new Error("Forbidden: Invalid referer header");
    }

    if (refererOrigin !== expectedOrigin) {
      throw new Error("Forbidden: Cross-origin request");
    }
    return;
  }

  if (options?.enforceMissingHeaders ?? true) {
    throw new Error("Forbidden: Missing CSRF headers");
  }
}

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const isLocalDev =
      serverEnv.NODE_ENV === "development" && !serverEnv.NAIS_CLUSTER_NAME;

    // Mock data mode (default in local dev) or local dev without NAIS context: no auth.
    if (isMockMode() || isLocalDev) {
      return next({
        context: {
          backendUrl: BACKEND_URL,
          oboToken: null,
        } as AuthContext,
      });
    }

    // CSRF mitigation: reject cross-origin unsafe requests in NAIS.
    // Require Origin or Referer match; reject if both are missing.
    if (!SAFE_METHODS.has(request.method.toUpperCase())) {
      try {
        validateCsrfHeaders(request, { enforceMissingHeaders: true });
      } catch (error) {
        logger.warn(
          {
            method: request.method,
            path: new URL(request.url).pathname,
            hasOrigin: Boolean(request.headers.get("origin")),
            hasReferer: Boolean(request.headers.get("referer")),
            reason:
              error instanceof Error ? error.message : "Unknown CSRF error",
          },
          "Rejected request due to CSRF validation failure",
        );
        throw error;
      }
    }

    // Production: dynamically import server-only oasis module
    // Using dynamic import ensures @navikt/oasis is never bundled into client code
    const { getToken, validateAzureToken, requestAzureOboToken } = await import(
      "@navikt/oasis"
    );

    const token = getToken(request);

    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const validation = await validateAzureToken(token);
    if (!validation.ok) {
      throw new Error("Unauthorized: Invalid token");
    }

    const oboResult = await requestAzureOboToken(token, BACKEND_AUDIENCE);
    if (!oboResult.ok) {
      logger.error({ audience: BACKEND_AUDIENCE }, "OBO token exchange failed");
      throw new Error("Token exchange failed");
    }

    return next({
      context: {
        backendUrl: BACKEND_URL,
        oboToken: oboResult.token,
      } as AuthContext,
    });
  },
);
