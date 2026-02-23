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
  const styleSrcParts = ["'self'", "https://cdn.nav.no", "'unsafe-inline'"];
  const styleSrcElemParts = ["'self'", "https://cdn.nav.no"];

  if (isDev) {
    // Vite CSS HMR injects inline <style> tags in development.
    styleSrcElemParts.push("'unsafe-inline'");
  }

  if (nonce) {
    scriptSrcParts.push(`'nonce-${nonce}'`);
  }

  scriptSrcParts.push(`'sha256-${themeInitHash}'`);

  return [
    "default-src 'self'",
    `script-src ${scriptSrcParts.join(" ")}`,
    `style-src ${styleSrcParts.join(" ")}`,
    // CSP level 3 split:
    // - style-src-elem governs <style> and stylesheet links
    // - style-src-attr governs style="" attributes
    `style-src-elem ${styleSrcElemParts.join(" ")}`,
    "style-src-attr 'unsafe-inline'",
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
