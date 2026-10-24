import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "lumi-theme-preference";

// Extend Window interface for the global theme variable
declare global {
  interface Window {
    __theme?: Theme;
  }
}

interface ThemeValue {
  theme: Theme | undefined;
  toggleTheme: () => void;
}

// The theme lives in this module instead of a React context. Components read
// it with useTheme(), and only they render again when it changes.
//
// With a context, the provider set the theme right after hydration. The new
// value changed a context above the routes before React had hydrated them, so
// React rendered them at once, and a route that failed during server rendering
// threw again and was reported as a recovered error (#520).
let currentTheme: Theme | undefined;
const listeners = new Set<() => void>();

function readInitialTheme(): Theme {
  // The theme script in <head> (config/themeInit.ts) has already chosen.
  if (window.__theme === "dark" || window.__theme === "light") {
    return window.__theme;
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch (_e) {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getSnapshot(): Theme {
  currentTheme ??= readInitialTheme();
  return currentTheme;
}

// The server does not know the viewer's theme. React uses the same value while
// it hydrates, so the first render in the browser matches the HTML from the
// server. Then it renders the components that read the theme again.
function getServerSnapshot(): Theme | undefined {
  return undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Aksel's tokens follow the "dark" class on <html>, so portals get them too.
// .app-theme-root keeps the theme class that Aksel's <Theme> used to set.
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);

  const themeRoot = document.querySelector(".app-theme-root");
  themeRoot?.classList.toggle("dark", theme === "dark");
  themeRoot?.classList.toggle("light", theme === "light");

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_e) {}
}

function toggleTheme(): void {
  currentTheme = getSnapshot() === "light" ? "dark" : "light";
  applyTheme(currentTheme);
  for (const listener of listeners) listener();
}

/**
 * Applies the theme to the document once the page has hydrated. It has no
 * state, so nothing renders again when it does.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    try {
      localStorage.removeItem("theme");
    } catch (_e) {}
    applyTheme(getSnapshot());
  }, []);

  return children;
}

export function useTheme(): ThemeValue {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => ({ theme, toggleTheme }), [theme]);
}

export function resetThemeForTesting(): void {
  currentTheme = undefined;
}
