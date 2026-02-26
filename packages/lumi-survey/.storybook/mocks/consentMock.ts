/**
 * Mock consent API globals for Storybook.
 *
 * Sets up `window.__DECORATOR_DATA__` and `window.webStorageController`
 * so that the consent storage strategy works in Storybook without the
 * real NAV consent API.
 */

const CONSENT_STORAGE_KEY = "__lumi_survey_storybook_consent__";

const getStoredConsent = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return stored === null ? true : stored === "true";
};

const setStoredConsent = (granted: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, granted.toString());
  window.dispatchEvent(
    new CustomEvent("__lumi_survey_consent_change__", {
      detail: { granted },
    }),
  );
};

type LumiMockConsentApi = {
  setConsent: (granted: boolean) => void;
  getConsent: () => boolean;
};

if (typeof window !== "undefined") {
  // Simulate the consent API globals that consentStorage.ts reads from
  (window as unknown as Record<string, unknown>).__DECORATOR_DATA__ = {
    mock: true,
  };
  (window as unknown as Record<string, unknown>).webStorageController = {
    isStorageKeyAllowed: (key: string) => key.startsWith("flexjar-"),
    getCurrentConsent: () => ({
      consent: {
        analytics: getStoredConsent(),
        surveys: getStoredConsent(),
      },
      userActionTaken: true,
    }),
  };

  (
    window as Window & { __LUMI_SURVEY_MOCK_CONSENT__?: LumiMockConsentApi }
  ).__LUMI_SURVEY_MOCK_CONSENT__ = {
    setConsent: setStoredConsent,
    getConsent: getStoredConsent,
  };
}
