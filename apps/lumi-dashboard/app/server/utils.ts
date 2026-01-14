import { publicEnv } from "~/publicEnv";
import type { AuthContext } from "~/server/middleware/auth";

/**
 * Check if the application is running in mock mode.
 * Checks both Vite client-side and Node.js server-side environment variables.
 */
import { serverEnv } from "~/serverEnv";

/**
 * Check if the application is running in mock mode.
 * Checks both Client-side and Server-side type-safe environment variables.
 */
export function isMockMode(): boolean {
  // Explicit client-side opt-in/out
  if (publicEnv.VITE_MOCK_DATA === "true") return true;
  if (publicEnv.VITE_MOCK_DATA === "false") return false;

  // Explicit server-side opt-in/out
  if (serverEnv.USE_MOCK_DATA === "true") return true;
  if (serverEnv.USE_MOCK_DATA === "false") return false;

  // Default behavior:
  // - Local dev => mock mode (good DX, no backend required)
  // - NAIS/prod => real backend
  // Client-side dev detection (Vite)
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return true;
  }

  // Server-side dev detection (Node)
  if (serverEnv.NODE_ENV === "development" && !serverEnv.NAIS_CLUSTER_NAME) {
    return true;
  }

  return false;
}

/**
 * Build a URL with query parameters.
 * Supports string values and string arrays (arrays get appended as repeated params).
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | string[] | undefined>,
): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        // Append each array value as a separate query param (repeated params)
        for (const v of value) {
          if (v) url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

/**
 * Create headers for backend requests with optional auth token.
 */
export function getHeaders(oboToken: string | null): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (oboToken) {
    headers.Authorization = `Bearer ${oboToken}`;
  }
  return headers;
}

/**
 * Simulate mock delay for realistic testing.
 */
export function mockDelay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Re-export AuthContext type for convenience
export type { AuthContext };
