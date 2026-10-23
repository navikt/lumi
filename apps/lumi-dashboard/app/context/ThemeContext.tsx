import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "lumi-theme-preference";

// Extend Window interface for the global theme variable
declare global {
  interface Window {
    __theme?: Theme;
  }
}

interface ThemeContextType {
  theme: Theme | undefined;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep first client render identical to SSR to avoid hydration mismatches.
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);

  // Sync theme before first paint on the client to avoid light/dark flash.
  useIsomorphicLayoutEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("theme");
      } catch (_e) {}

      // 0. Trust the blocking script (window.__theme) as the source of truth
      if (window.__theme === "dark" || window.__theme === "light") {
        if (window.__theme !== theme) setThemeState(window.__theme);
        return;
      }

      // Fallback 1. LocalStorage checking (should be handled by script but just in case)
      const local = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (local === "light" || local === "dark") {
        // Only update if different
        if (local !== theme) setThemeState(local);
        return;
      }

      // Fallback 2. System preference checking
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const computed = systemDark ? "dark" : "light";
      // Only update if different
      if (computed !== theme) setThemeState(computed);
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!theme) return; // Don't do anything if theme is undefined

    const root = document.documentElement;
    const body = document.body;

    // Only update if the theme actually changed or is different from attribute
    if (root.getAttribute("data-theme") !== theme) {
      root.setAttribute("data-theme", theme);
      body.setAttribute("data-theme", theme);

      // Crucial: Aksel Darkside tokens depend on the ".dark" class
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_e) {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  // The root shell renders this provider again on every navigation. A new
  // value object would make the charts and ThemeToggle render again too.
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
