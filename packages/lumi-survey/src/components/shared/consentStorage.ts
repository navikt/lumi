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

interface StorageResult {
  storage: StorageLike | null;
  allowed: boolean;
}

interface WriteResult {
  persisted: boolean;
  allowed: boolean;
  error?: unknown;
}

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

const getStorage = async (key: string): Promise<StorageResult> => {
  const ready = await awaitConsentApi();

  if (!ready) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        "[Lumi] Consent API not available - using initialOpen without persistence",
      );
    }
    return { storage: null, allowed: false };
  }

  const controller = getConsentController();

  if (
    !controller ||
    typeof controller.isStorageKeyAllowed !== "function" ||
    typeof controller.getCurrentConsent !== "function"
  ) {
    return { storage: null, allowed: false };
  }

  if (!controller.isStorageKeyAllowed(key)) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        `[Lumi] Storage key "${key}" not in allowed storage list - using initialOpen without persistence.`,
      );
    }
    return { storage: null, allowed: false };
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
      return { storage: null, allowed: false };
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log("[Lumi] Could not check consent:", error);
    }
    return { storage: null, allowed: false };
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- development diagnostics only
    console.log(`[Lumi] Storage key "${key}" is allowed - persistence enabled`);
  }

  try {
    return { storage: window.localStorage, allowed: true };
  } catch {
    return { storage: null, allowed: false };
  }
};

export const readConsentValue = async (key: string): Promise<string | null> => {
  const { storage } = await getStorage(key);
  if (storage) {
    try {
      return storage.getItem(key);
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
): Promise<WriteResult> => {
  const { storage, allowed } = await getStorage(key);

  if (storage && allowed) {
    try {
      storage.setItem(key, value);
      return { persisted: true, allowed: true };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.warn("[Lumi] Failed to write to consent storage", error);
      }
      return { persisted: false, allowed: false, error };
    }
  }

  return { persisted: false, allowed: false };
};

export const removeConsentValue = async (key: string): Promise<void> => {
  const { storage } = await getStorage(key);
  if (storage) {
    try {
      storage.removeItem(key);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console -- development diagnostics only
        console.warn("[Lumi] Failed to remove from consent storage", error);
      }
    }
  }
};

export type { WriteResult };
