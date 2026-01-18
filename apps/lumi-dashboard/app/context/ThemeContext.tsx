import { createContext, useContext, useEffect, useState } from "react";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize to undefined so we don't override the SSR/Script-injected theme
  // until we know for sure what the client preference is.
  const [theme, setThemeState] = useState<Theme | undefined>(() => {
    if (typeof window !== "undefined" && window.__theme) {
      return window.__theme;
    }
    return undefined;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run once
  useEffect(() => {
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

  useEffect(() => {
    if (!theme) return; // Don't do anything if theme is undefined

    const root = document.documentElement;
    const body = document.body;

    // Only update if the theme actually changed or is different from attribute
    if (root.getAttribute("data-theme") !== theme) {
      root.setAttribute("data-theme", theme);
      root.style.colorScheme = theme;
      body.setAttribute("data-theme", theme);
      body.style.colorScheme = theme;

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

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
