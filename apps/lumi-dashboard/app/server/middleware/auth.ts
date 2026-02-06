import { createMiddleware } from "@tanstack/react-start";

import { logger } from "~/server/logger";
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
import { isMockMode } from "~/server/utils";

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

    // CSRF mitigation: reject cross-origin unsafe requests.
    // In NAIS, auth is typically provided via sidecar-injected headers/cookies.
    // Verifying Origin for state-changing requests prevents drive-by cross-site calls.
    if (request.method !== "GET" && request.method !== "HEAD") {
      const origin = request.headers.get("origin");
      if (origin) {
        const expectedOrigin = new URL(request.url).origin;
        if (origin !== expectedOrigin) {
          throw new Error("Forbidden: Cross-origin request");
        }
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
