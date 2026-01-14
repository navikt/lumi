import { useCallback, useSyncExternalStore } from "react";

export interface SearchParams {
  team?: string;
  app?: string;
  page?: string;
  size?: string;
  fromDate?: string;
  toDate?: string;
  hasText?: string;
  query?: string;
  tag?: string;
  surveyId?: string;
  /** Filter by pathname (from context) */
  pathname?: string;
  /** Filter by low ratings (1-2) */
  lowRating?: string;
  /** Filter by device type */
  deviceType?: string;

  /** Filter by theme (for discovery drill-down) */
  theme?: string;

  /** Filter by context.tags (format: "key:value,key:value") */
  segment?: string;

  /** Filter by specific task (for Top Tasks drill-down) */
  task?: string;
}

// Store for managing search params reactively
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);

  // Also listen to browser events
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", listener);
  }

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", listener);
    }
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function useSearchParams() {
  // Use useSyncExternalStore for SSR-safe reactive URL params
  const search = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Parse params from the search string
  const params: SearchParams = search
    ? (Object.fromEntries(new URLSearchParams(search)) as SearchParams)
    : {};

  const setParam = useCallback(
    (key: keyof SearchParams, value: string | undefined) => {
      if (typeof window === "undefined") return;

      const url = new URL(window.location.href);
      if (value === undefined || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
      window.history.pushState({}, "", url.toString());
      notifyListeners();
    },
    [],
  );

  const setParams = useCallback((newParams: Partial<SearchParams>) => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(newParams)) {
      if (value === undefined || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    window.history.pushState({}, "", url.toString());
    notifyListeners();
  }, []);

  const resetParams = useCallback(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.search = "";
    window.history.pushState({}, "", url.toString());
    notifyListeners();
  }, []);

  return { params, setParam, setParams, resetParams };
}
