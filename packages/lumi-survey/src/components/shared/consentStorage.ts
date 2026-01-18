interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface ConsentModule {
  awaitDecoratorData?: () => Promise<void>;
  isStorageKeyAllowed?: (key: string) => boolean;
  navLocalStorage?: StorageLike;
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

let modulePromise: Promise<ConsentModule | null> | null = null;

const loadConsentModule = async (): Promise<ConsentModule | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        const mod = await import("@navikt/nav-dekoratoren-moduler");
        if (typeof mod.awaitDecoratorData === "function") {
          try {
            await mod.awaitDecoratorData();
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console -- development diagnostics only
              console.warn("Lumi: awaitDecoratorData failed", error);
            }
          }
        }
        return {
          awaitDecoratorData: mod.awaitDecoratorData,
          isStorageKeyAllowed: mod.isStorageKeyAllowed,
          navLocalStorage: mod.navLocalStorage,
        } satisfies ConsentModule;
      } catch (_error) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- development diagnostics only
          console.log(
            "[Lumi] @navikt/nav-dekoratoren-moduler not available - using initialOpen without persistence",
          );
        }
        return null;
      }
    })();
  }

  return modulePromise;
};

const getStorage = async (key: string): Promise<StorageResult> => {
  const module = await loadConsentModule();

  if (!module) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        "[Lumi] Consent module not available - using initialOpen without persistence",
      );
    }
    return {
      storage: null,
      allowed: false,
    };
  }

  const { navLocalStorage, isStorageKeyAllowed } = module;

  if (!navLocalStorage) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        "[Lumi] navLocalStorage not available - using initialOpen without persistence",
      );
    }
    return {
      storage: null,
      allowed: false,
    };
  }

  if (typeof isStorageKeyAllowed !== "function") {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        "[Lumi] isStorageKeyAllowed not available - using initialOpen without persistence",
      );
    }
    return {
      storage: null,
      allowed: false,
    };
  }

  const allowed = isStorageKeyAllowed(key);

  if (!allowed) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log(
        `[Lumi] Storage key "${key}" not in NAV's allowed storage list - using initialOpen without persistence. (Temporary: Lumi still uses the legacy "flexjar-*" key pattern until NAV allowlists a new pattern.)`,
      );
    }
    return {
      storage: null,
      allowed: false,
    };
  }

  // Check if user has granted surveys consent
  try {
    const getCurrentConsent = module.awaitDecoratorData
      ? (await import("@navikt/nav-dekoratoren-moduler")).getCurrentConsent
      : undefined;

    if (getCurrentConsent) {
      const consent = getCurrentConsent();
      if (!consent?.consent?.surveys) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- development diagnostics only
          console.log(
            "[Lumi] User has not granted surveys consent - using initialOpen without persistence",
          );
        }
        return {
          storage: null,
          allowed: false,
        };
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- development diagnostics only
      console.log("[Lumi] Could not check consent:", error);
    }
    // If we can't check consent, don't allow persistence to be safe
    return {
      storage: null,
      allowed: false,
    };
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- development diagnostics only
    console.log(`[Lumi] Storage key "${key}" is allowed - persistence enabled`);
  }

  return {
    storage: navLocalStorage,
    allowed: true,
  };
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

  // No storage available - return null to use initialOpen behavior
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

  // No storage available - don't persist, just return not persisted
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
  // No need to manage memoryFallback since we don't use it anymore
};

export type { WriteResult };
