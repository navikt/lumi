import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { logger } from "~/server/logger";
import { resolveLocalAuthPolicy } from "~/server/middleware/localAuthPolicy";
import { isMockMode } from "~/server/utils";
import { serverEnv } from "~/serverEnv";

const BACKEND_URL = serverEnv.LUMI_API_URL || "http://localhost:8080";

const BACKEND_AUDIENCE =
  serverEnv.LUMI_API_AUDIENCE || "api://dev-gcp.team-esyfo.lumi-api/.default";

export interface AuthContext {
  backendUrl: string;
  oboToken: string | null;
}

type AzureOboResult =
  | { ok: true; token: string }
  | { ok: false; error?: unknown; message?: string };

type AzureOboRequest = (
  token: string,
  audience: string,
) => Promise<AzureOboResult>;

const OBO_CACHE_EXPIRY_SKEW_MS = 60_000;
const DEFAULT_OBO_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_OBO_CACHE_ENTRIES = 500;

const oboTokenCache = new Map<string, { token: string; expiresAtMs: number }>();
const inFlightOboRequests = new Map<string, Promise<string>>();
const JWT_LIKE_VALUE_PATTERN =
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const NORWEGIAN_ID_NUMBER_PATTERN = /\b\d{11}\b/g;
const MAX_OBO_DIAGNOSTIC_LENGTH = 500;

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function getJwtExpiresAtMs(token: string): number | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(digest));
}

async function getOboCacheKey(
  token: string,
  audience: string,
): Promise<string> {
  return sha256Hex(`${audience}\0${token}`);
}

export function clearOboTokenCacheForTesting(): void {
  oboTokenCache.clear();
  inFlightOboRequests.clear();
}

function pruneOboTokenCache(now: number): void {
  for (const [key, cached] of oboTokenCache) {
    if (cached.expiresAtMs - OBO_CACHE_EXPIRY_SKEW_MS <= now) {
      oboTokenCache.delete(key);
    }
  }

  while (oboTokenCache.size >= MAX_OBO_CACHE_ENTRIES) {
    const oldestKey = oboTokenCache.keys().next().value;
    if (!oldestKey) break;
    oboTokenCache.delete(oldestKey);
  }
}

function sanitizeOboDiagnosticMessage(message: string): string {
  return message
    .replace(JWT_LIKE_VALUE_PATTERN, "[redacted-jwt]")
    .replace(NORWEGIAN_ID_NUMBER_PATTERN, "[redacted-id]")
    .slice(0, MAX_OBO_DIAGNOSTIC_LENGTH);
}

function extractOboErrorMessage(
  result: Extract<AzureOboResult, { ok: false }>,
): string | undefined {
  const message =
    result.message ??
    (result.error instanceof Error ? result.error.message : undefined) ??
    (typeof result.error === "string" ? result.error : undefined);
  return message ? sanitizeOboDiagnosticMessage(message) : undefined;
}

export async function getCachedAzureOboToken(
  token: string,
  audience: string,
  requestAzureOboToken: AzureOboRequest,
): Promise<string> {
  const cacheKey = await getOboCacheKey(token, audience);
  const now = Date.now();
  const cached = oboTokenCache.get(cacheKey);

  if (cached && cached.expiresAtMs - OBO_CACHE_EXPIRY_SKEW_MS > now) {
    return cached.token;
  }

  const inFlight = inFlightOboRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const oboResult = await requestAzureOboToken(token, audience);
    if (!oboResult.ok) {
      const diagnosticMessage = extractOboErrorMessage(oboResult);
      throw new Error(
        `Token exchange failed${diagnosticMessage ? `: ${diagnosticMessage}` : ""}`,
      );
    }

    const freshNow = Date.now();
    const expiresAtMs =
      getJwtExpiresAtMs(oboResult.token) ?? freshNow + DEFAULT_OBO_CACHE_TTL_MS;

    // Only cache if the token is still valid outside the skew window
    if (expiresAtMs - OBO_CACHE_EXPIRY_SKEW_MS > freshNow) {
      pruneOboTokenCache(freshNow);
      oboTokenCache.set(cacheKey, {
        token: oboResult.token,
        expiresAtMs,
      });
    }

    return oboResult.token;
  })();

  inFlightOboRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightOboRequests.delete(cacheKey);
  }
}

/**
 * Reusable authentication middleware for server functions.
 *
 * - In NAIS environment: Validates Azure token and exchanges for OBO token
 * - In local mock mode: Returns no token
 * - In explicit local real-data mode: Returns the API's non-secret local token
 *
 * Provides AuthContext to downstream handlers with backendUrl and oboToken.
 */

const SAFE_METHODS = new Set(["GET", "HEAD"]);

function failWithStatus(status: number, message: string): never {
  setResponseStatus(status);
  throw new Error(message);
}

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
    const localAuthPolicy = resolveLocalAuthPolicy({
      isMockMode: isMockMode(),
      naisClusterName: serverEnv.NAIS_CLUSTER_NAME,
      localAuthBypass: serverEnv.LUMI_LOCAL_AUTH_BYPASS,
    });

    // Mock mode needs no backend token. Local real-data mode is a separate,
    // explicit opt-in and uses the API's local bearer realm.
    if (localAuthPolicy.bypassEnabled) {
      return next({
        context: {
          backendUrl: BACKEND_URL,
          oboToken: localAuthPolicy.oboToken,
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
        failWithStatus(
          403,
          error instanceof Error
            ? error.message
            : "Forbidden: CSRF validation failed",
        );
      }
    }

    // Production: dynamically import server-only oasis module
    // Using dynamic import ensures @navikt/oasis is never bundled into client code
    const { getToken, validateAzureToken, requestAzureOboToken } = await import(
      "@navikt/oasis"
    );

    const token = getToken(request);

    if (!token) {
      failWithStatus(401, "Unauthorized: No token provided");
    }

    const validation = await validateAzureToken(token);
    if (!validation.ok) {
      failWithStatus(401, "Unauthorized: Invalid token");
    }

    let oboToken: string;
    try {
      oboToken = await getCachedAzureOboToken(
        token,
        BACKEND_AUDIENCE,
        requestAzureOboToken,
      );
    } catch (error) {
      logger.error(
        {
          audience: BACKEND_AUDIENCE,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        },
        "OBO token exchange failed",
      );
      failWithStatus(502, "Token exchange failed");
    }

    return next({
      context: {
        backendUrl: BACKEND_URL,
        oboToken,
      } as AuthContext,
    });
  },
);
