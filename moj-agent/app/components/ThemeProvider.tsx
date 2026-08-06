"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isTheme, themeStorageKey, type Theme } from "../lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const appliedTheme = document.documentElement.dataset.theme;
    if (isTheme(appliedTheme)) return appliedTheme;
  }

  if (typeof window !== "undefined") {
    try {
      const storedTheme = window.localStorage.getItem(themeStorageKey);
      if (isTheme(storedTheme)) return storedTheme;
    } catch {
      // The system preference remains a safe fallback when storage is blocked.
    }

    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  return "dark";
}

function applyTheme(theme: Theme, persist: boolean) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  if (persist) {
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Theme changes still work when storage is unavailable.
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme, true);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const appliedTheme = document.documentElement.dataset.theme;
    setTheme(appliedTheme === "light" ? "dark" : "light");
  }, [setTheme]);

  useEffect(() => {
    let hasStoredPreference = false;

    try {
      hasStoredPreference = isTheme(window.localStorage.getItem(themeStorageKey));
    } catch {
      // A blocked storage API means the system preference stays authoritative.
    }

    if (hasStoredPreference) return;

    const preference = window.matchMedia("(prefers-color-scheme: light)");
    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      const nextTheme: Theme = event.matches ? "light" : "dark";
      applyTheme(nextTheme, false);
      setThemeState(nextTheme);
    };

    preference.addEventListener("change", handlePreferenceChange);
    return () => preference.removeEventListener("change", handlePreferenceChange);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
