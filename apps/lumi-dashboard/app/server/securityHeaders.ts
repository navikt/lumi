import { createHash } from "node:crypto";

import { THEME_INIT_SCRIPT } from "~/config/themeInit";

export function sha256Base64(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

export function buildCspHeaderValue(options?: {
  isDev?: boolean;
  nonce?: string;
}): string {
  const themeInitHash = sha256Base64(THEME_INIT_SCRIPT);
  const isDev = options?.isDev === true;
  const nonce = options?.nonce;

  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";
  const scriptSrcParts = ["'self'", "https://cdn.nav.no"];

  if (nonce) {
    scriptSrcParts.push(`'nonce-${nonce}'`);
  }

  scriptSrcParts.push(`'sha256-${themeInitHash}'`);

  return [
    "default-src 'self'",
    `script-src ${scriptSrcParts.join(" ")}`,
    // TODO: Remove 'unsafe-inline' from style-src once Recharts (which injects
    // inline styles on SVG/container elements) is replaced or supports nonce.
    // All project-owned inline styles have been migrated to CSS modules.
    "style-src 'self' https://cdn.nav.no 'unsafe-inline'",
    "img-src 'self' data: https://cdn.nav.no",
    "font-src 'self' data: https://cdn.nav.no",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function applyBaselineSecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  headers.set("X-Frame-Options", "DENY");
}
