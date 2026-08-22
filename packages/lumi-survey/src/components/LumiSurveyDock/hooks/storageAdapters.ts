import {
  readConsentValue,
  removeConsentValue,
  type StorageMutationResult,
  writeConsentValue,
} from "../../shared/consentStorage.js";
import type { StorageStrategy } from "../propTypes.js";

export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<StorageMutationResult>;
  remove(key: string): Promise<StorageMutationResult>;
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
  async write(key: string, value: string): Promise<StorageMutationResult> {
    if (typeof window === "undefined") return { outcome: "skipped" };
    try {
      window.localStorage.setItem(key, value);
      return { outcome: "applied" };
    } catch (error) {
      return { outcome: "failed", error };
    }
  },
  async remove(key: string): Promise<StorageMutationResult> {
    if (typeof window === "undefined") return { outcome: "skipped" };
    try {
      window.localStorage.removeItem(key);
      return { outcome: "applied" };
    } catch (error) {
      return { outcome: "failed", error };
    }
  },
};

// No-op storage for "none" strategy
const noopStorageAdapter: StorageAdapter = {
  async read(): Promise<string | null> {
    return null;
  },
  async write(): Promise<StorageMutationResult> {
    return { outcome: "skipped" };
  },
  async remove(): Promise<StorageMutationResult> {
    return { outcome: "skipped" };
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
