import type { DeviceType } from "../../../core/types.js";

const TABLET_UA = /iPad|Android(?!.*Mobile)/i;
const MOBILE_UA =
  /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Windows Phone|Opera Mini|IEMobile/i;

/**
 * Detects actual device type using multiple browser signals.
 *
 * Priority:
 * 1. UA string tablet patterns (distinctive, checked first)
 * 2. UA Client Hints (navigator.userAgentData) for mobile vs desktop
 * 3. UA string mobile patterns
 * 4. iPadOS 13+ heuristic (Macintosh UA + multi-touch)
 * 5. Viewport width fallback (SSR, unknown UA)
 */
export function detectDeviceType(viewportWidth: number): DeviceType {
  if (typeof navigator === "undefined") {
    return classifyByViewport(viewportWidth);
  }

  const ua = navigator.userAgent || "";

  // Tablet patterns are distinctive — check regardless of Client Hints.
  // Catches iPad (pre-iPadOS 13) and Android tablets (no "Mobile" token).
  if (TABLET_UA.test(ua)) {
    return "tablet";
  }

  // Client Hints (Chromium 90+): authoritative mobile/desktop signal.
  const uaData = navigator.userAgentData;
  if (uaData !== undefined) {
    return uaData.mobile ? "mobile" : "desktop";
  }

  // No Client Hints — fall back to UA string patterns.
  if (ua) {
    if (MOBILE_UA.test(ua)) {
      return "mobile";
    }

    // iPadOS 13+ Safari sends a Mac-like UA without "iPad" and no Client Hints.
    // Detect via Macintosh UA + multi-touch support (real Macs have 0 touch points).
    const isMacLike =
      ua.includes("Macintosh") || navigator.platform === "MacIntel";
    const hasTouch =
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1;
    if (isMacLike && hasTouch) {
      return "tablet";
    }

    // UA present but no mobile/tablet match → desktop
    return "desktop";
  }

  // No signals — viewport fallback (SSR or missing UA)
  return classifyByViewport(viewportWidth);
}

/**
 * Viewport-only classification, for simulated viewports in embedded
 * previews where the real UA must not leak through.
 */
export function classifyDeviceTypeByViewport(width: number): DeviceType {
  return classifyByViewport(width);
}

function classifyByViewport(width: number): DeviceType {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
