/**
 * Mock consent module for Storybook
 * Uses localStorage to persist consent state for realistic testing
 */

const CONSENT_STORAGE_KEY = "__flexjar_storybook_consent__";

// NOTE: Keep legacy Flexjar keys for now.
// We still rely on NAV's existing allowlist pattern for `flexjar-*`.
console.log("[Lumi Mock] Loading consent mock module for Storybook");

const getStoredConsent = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  const consent = stored === null ? true : stored === "true";
  console.log("[Lumi Mock] getStoredConsent:", consent);
  return consent;
};

const setStoredConsent = (granted: boolean) => {
  if (typeof window === "undefined") return;
  console.log("[Lumi Mock] setStoredConsent:", granted);
  window.localStorage.setItem(CONSENT_STORAGE_KEY, granted.toString());

  // Manually dispatch custom event since storage events don't fire in the same window
  window.dispatchEvent(
    new CustomEvent("__flexjar_consent_change__", {
      detail: { granted },
    }),
  );
};

type LumiMockConsentApi = {
  setConsent: (granted: boolean) => void;
  getConsent: () => boolean;
};

// Expose globally for Storybook controls
if (typeof window !== "undefined") {
  const api: LumiMockConsentApi = {
    setConsent: setStoredConsent,
    getConsent: getStoredConsent,
  };

  (
    window as Window & {
      __LUMI_SURVEY_MOCK_CONSENT__?: LumiMockConsentApi;
      __FLEXJAR_MOCK_CONSENT__?: LumiMockConsentApi;
    }
  ).__LUMI_SURVEY_MOCK_CONSENT__ = api;

  // Backwards-compatible alias (ported code + any existing stories)
  (
    window as Window & {
      __FLEXJAR_MOCK_CONSENT__?: LumiMockConsentApi;
    }
  ).__FLEXJAR_MOCK_CONSENT__ = api;

  console.log(
    "[Lumi Mock] Global API exposed as window.__LUMI_SURVEY_MOCK_CONSENT__ (and __FLEXJAR_MOCK_CONSENT__) ",
  );
}

// Mock getCurrentConsent - reads from localStorage (synchronous like the real API)
export const getCurrentConsent = () => {
  const consentGranted = getStoredConsent();
  console.log("[Lumi Mock] getCurrentConsent called, returning:", {
    consent: { surveys: consentGranted, statistics: consentGranted },
  });
  return {
    consent: {
      surveys: consentGranted,
      statistics: consentGranted,
    },
    userActionTaken: true,
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 2,
    },
  };
};

// Mock other exports that might be needed
export const awaitDecoratorData = async () => {
  console.log("[Lumi Mock] awaitDecoratorData called (no-op)");
  // No-op in Storybook
};

export const isStorageKeyAllowed = (key: string) => {
  const allowed = key.startsWith("flexjar-");
  console.log("[Lumi Mock] isStorageKeyAllowed:", key, "→", allowed);
  return allowed;
};

export const navLocalStorage =
  typeof window !== "undefined" ? window.localStorage : null;

if (navLocalStorage) {
  console.log("[Lumi Mock] navLocalStorage available");
}
