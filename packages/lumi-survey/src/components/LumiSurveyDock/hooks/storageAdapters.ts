import {
  readConsentValue,
  removeConsentValue,
  writeConsentValue,
} from "../../shared/consentStorage.js";
import type { StorageStrategy } from "../propTypes.js";

export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(
    key: string,
    value: string,
  ): Promise<{ persisted: boolean; allowed: boolean; error?: unknown }>;
  remove(key: string): Promise<void>;
}

// Simple localStorage wrapper
const localStorageAdapter: StorageAdapter = {
  async read(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async write(
    key: string,
    value: string,
  ): Promise<{ persisted: boolean; allowed: boolean; error?: unknown }> {
    if (typeof window === "undefined")
      return { persisted: false, allowed: false };
    try {
      window.localStorage.setItem(key, value);
      return { persisted: true, allowed: true };
    } catch (error) {
      return { persisted: false, allowed: false, error };
    }
  },
  async remove(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

// No-op storage for "none" strategy
const noopStorageAdapter: StorageAdapter = {
  async read(): Promise<string | null> {
    return null;
  },
  async write(): Promise<{
    persisted: boolean;
    allowed: boolean;
    error?: unknown;
  }> {
    return { persisted: false, allowed: true };
  },
  async remove(): Promise<void> {
    // no-op
  },
};

// Consent storage adapter (existing behavior)
const consentStorageAdapter: StorageAdapter = {
  read: readConsentValue,
  write: writeConsentValue,
  remove: removeConsentValue,
};

export const getStorageAdapter = (
  strategy: StorageStrategy,
): StorageAdapter => {
  switch (strategy) {
    case "localStorage":
      return localStorageAdapter;
    case "none":
      return noopStorageAdapter;
    default:
      return consentStorageAdapter;
  }
};
