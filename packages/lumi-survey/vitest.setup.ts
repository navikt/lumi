import "@testing-library/jest-dom/vitest";

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Set up consent API globals so the consent storage strategy resolves immediately
(globalThis as unknown as Record<string, unknown>).__DECORATOR_DATA__ = {
  mock: true,
};
(globalThis as unknown as Record<string, unknown>).webStorageController = {
  isStorageKeyAllowed: (key: string) => key.startsWith("flexjar-"),
  getCurrentConsent: () => ({
    consent: { analytics: true, surveys: true },
    userActionTaken: true,
  }),
};
