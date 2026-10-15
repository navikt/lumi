/**
 * Consent-based storage for environments with the NAV consent API.
 *
 * On nav.no pages the NAV decorator sets `window.__DECORATOR_DATA__` and
 * `window.webStorageController` when it initializes. This module polls for
 * those globals and uses the consent API to gate localStorage access.
 */

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface Consent {
  consent: {
    analytics: boolean;
    surveys: boolean;
  };
  userActionTaken: boolean;
}

interface WebStorageController {
  isStorageKeyAllowed: (key: string) => boolean;
  getCurrentConsent: () => Consent;
  getAllowedStorage?: () => unknown[];
}

/** Window shape when the NAV consent API globals are present. */
interface ConsentWindow extends Window {
  __DECORATOR_DATA__?: unknown;
  webStorageController?: WebStorageController;
}

type StorageAccessResult =
  | { outcome: "available"; storage: StorageLike }
  | { outcome: "skipped" }
  | { outcome: "failed"; error: unknown };

/** `skipped` is reserved for intentional no-persistence contexts such as SSR. */
export type StorageMutationResult =
  | { outcome: "applied" }
  | { outcome: "skipped" }
  | { outcome: "failed"; error: unknown };

/**
 * `empty` means storage works but holds no value, or persistence is
 * intentionally off (SSR, the `none` strategy). `unavailable` means the value
 * could not be read and a later write would not be kept either.
 */
export type StorageReadResult =
  | { outcome: "found"; value: string }
  | { outcome: "empty" }
  | { outcome: "unavailable"; error: unknown };

const CONSENT_READY_TIMEOUT_MS = 5000;
const CONSENT_POLL_INTERVAL_MS = 50;

let consentReady: Promise<boolean> | null = null;
let setupWarningShown = false;

const STORAGE_DOCS_URL = "https://navikt.github.io/lumi/guider/lagring";

/** What the app team can do about a consent setup problem. */
type ConsentSetupProblem = "decorator-missing" | "key-refused";

const CONSENT_SETUP_ADVICE: Record<ConsentSetupProblem, string> = {
  "decorator-missing":
    'Apps without the Nav decorator should set behavior.storageStrategy to "localStorage".',
  "key-refused": "Ask in #lumi on Slack to have the storage key allowed.",
};

/**
 * Warn once per page load, also in production, when the consent setup itself
 * is missing or misconfigured. A user who declines consent is expected and
 * stays silent.
 */
const warnConsentSetupOnce = (
  kind: ConsentSetupProblem,
  problem: string,
): void => {
  if (setupWarningShown) {
    return;
  }
  setupWarningShown = true;
  // eslint-disable-next-line no-console -- intentional diagnostics for app teams
  console.warn(
    `[Lumi] ${problem} The survey widget starts minimized and cannot remember that the survey was closed or answered. ${CONSENT_SETUP_ADVICE[kind]} See ${STORAGE_DOCS_URL}`,
  );
};

const awaitConsentApi = (): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (!consentReady) {
    const w = window as ConsentWindow;

    if (w.__DECORATOR_DATA__ && w.webStorageController) {
      consentReady = Promise.resolve(true);
    } else {
      consentReady = new Promise((resolve) => {
        const interval = setInterval(() => {
          if (w.__DECORATOR_DATA__ && w.webStorageController) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(true);
          }
        }, CONSENT_POLL_INTERVAL_MS);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          // getStorage reports the missing API once with console.warn.
          resolve(false);
        }, CONSENT_READY_TIMEOUT_MS);
      });
    }
  }

  return consentReady;
};

const getConsentController = (): WebStorageController | null => {
  if (typeof window === "undefined") return null;
  return (window as ConsentWindow).webStorageController ?? null;
};

const hasSurveyConsent = (controller: WebStorageController): boolean => {
  try {
    return controller.getCurrentConsent()?.consent?.surveys === true;
  } catch {
    return false;
  }
};

const getStorage = async (key: string): Promise<StorageAccessResult> => {
  if (typeof window === "undefined") {
    return { outcome: "skipped" };
  }

  const ready = await awaitConsentApi();

  if (!ready) {
    warnConsentSetupOnce(
      "decorator-missing",
      "The Nav decorator consent API (window.webStorageController) was not found within five seconds.",
    );
    return {
      outcome: "failed",
      error: new Error("NAV consent API is unavailable"),
    };
  }

  const controller = getConsentController();

  if (
    !controller ||
    typeof controller.isStorageKeyAllowed !== "function" ||
    typeof controller.getCurrentConsent !== "function"
  ) {
    warnConsentSetupOnce(
      "decorator-missing",
      "The Nav decorator consent API (window.webStorageController) is incomplete.",
    );
    return {
      outcome: "failed",
      error: new Error("NAV consent API is not usable"),
    };
  }

  let storageKeyAllowed: boolean;
  try {
    storageKeyAllowed = controller.isStorageKeyAllowed(key);
  } catch (error) {
    warnConsentSetupOnce(
      "key-refused",
      `The Nav decorator could not check the storage key "${key}".`,
    );
    return { outcome: "failed", error };
  }

  if (!storageKeyAllowed) {
    // The decorator may also refuse keys while consent is missing. Only a
    // refusal despite survey consent points to a missing allowlist entry.
    if (hasSurveyConsent(controller)) {
      warnConsentSetupOnce(
        "key-refused",
        `The Nav decorator does not allow the storage key "${key}", although the user has consented to surveys.`,
      );
    }
    return {
      outcome: "failed",
      error: new Error(
        `Storage key "${key}" is not allowed by the NAV consent API`,
      ),
    };
  }

  try {
    const consent = controller.getCurrentConsent();
    if (!consent?.consent?.surveys) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.log(
          "[Lumi] User has not granted surveys consent - starting minimized without persistence",
        );
      }
      return {
        outcome: "failed",
        error: new Error("Survey storage consent has not been granted"),
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log("[Lumi] Could not check consent:", error);
    }
    return { outcome: "failed", error };
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- development diagnostics only
    console.log(`[Lumi] Storage key "${key}" is allowed - persistence enabled`);
  }

  try {
    return { outcome: "available", storage: window.localStorage };
  } catch (error) {
    return { outcome: "failed", error };
  }
};

export const readConsentValue = async (
  key: string,
): Promise<StorageReadResult> => {
  const result = await getStorage(key);
  if (result.outcome === "skipped") {
    return { outcome: "empty" };
  }
  if (result.outcome === "failed") {
    return { outcome: "unavailable", error: result.error };
  }

  try {
    const value = result.storage.getItem(key);
    return value === null ? { outcome: "empty" } : { outcome: "found", value };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.warn("[Lumi] Failed to read from consent storage", error);
    }
    return { outcome: "unavailable", error };
  }
};

export const writeConsentValue = async (
  key: string,
  value: string,
): Promise<StorageMutationResult> => {
  const result = await getStorage(key);

  if (result.outcome === "available") {
    try {
      result.storage.setItem(key, value);
      return { outcome: "applied" };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.warn("[Lumi] Failed to write to consent storage", error);
      }
      return { outcome: "failed", error };
    }
  }

  return result;
};

export const removeConsentValue = async (
  key: string,
): Promise<StorageMutationResult> => {
  const result = await getStorage(key);
  if (result.outcome === "available") {
    try {
      result.storage.removeItem(key);
      return { outcome: "applied" };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.warn("[Lumi] Failed to remove from consent storage", error);
      }
      return { outcome: "failed", error };
    }
  }

  return result;
};
