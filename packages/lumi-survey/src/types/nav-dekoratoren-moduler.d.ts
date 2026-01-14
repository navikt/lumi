declare module "@navikt/nav-dekoratoren-moduler" {
  export function awaitDecoratorData(): Promise<void>;
  export function isStorageKeyAllowed(key: string): boolean;

  export type Storage = {
    name: string;
    type: "cookie" | "localstorage" | "sessionstorage";
    optional: boolean;
  };

  export function getAllowedStorage(): Storage[];

  export type Consent = {
    consent: {
      analytics: boolean;
      surveys: boolean;
    };
    userActionTaken: boolean;
    meta: {
      createdAt: string;
      updatedAt: string;
      version: number;
    };
  };

  export function getCurrentConsent(): Consent;

  export const navLocalStorage:
    | {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
      }
    | undefined;
}
