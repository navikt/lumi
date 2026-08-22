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

const CONSENT_READY_TIMEOUT_MS = 5000;
const CONSENT_POLL_INTERVAL_MS = 50;

let consentReady: Promise<boolean> | null = null;

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
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console -- development diagnostics only
            console.log(
              "[Lumi] Consent API not detected within timeout - consent storage unavailable",
            );
          }
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

const getStorage = async (key: string): Promise<StorageAccessResult> => {
  if (typeof window === "undefined") {
    return { outcome: "skipped" };
  }

  const ready = await awaitConsentApi();

  if (!ready) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        "[Lumi] Consent API not available - using initialOpen without persistence",
      );
    }
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
    return {
      outcome: "failed",
      error: new Error("NAV consent API is not usable"),
    };
  }

  let storageKeyAllowed: boolean;
  try {
    storageKeyAllowed = controller.isStorageKeyAllowed(key);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log("[Lumi] Could not check the storage key:", error);
    }
    return { outcome: "failed", error };
  }

  if (!storageKeyAllowed) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        `[Lumi] Storage key "${key}" not in allowed storage list - using initialOpen without persistence.`,
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
          "[Lumi] User has not granted surveys consent - using initialOpen without persistence",
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

export const readConsentValue = async (key: string): Promise<string | null> => {
  const result = await getStorage(key);
  if (result.outcome === "available") {
    try {
      return result.storage.getItem(key);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.warn("[Lumi] Failed to read from consent storage", error);
      }
    }
  }
  return null;
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
