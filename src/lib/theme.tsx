"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

function getInitialTheme(): { theme: Theme; resolved: ResolvedTheme } {
  if (typeof window === "undefined") return { theme: "dark", resolved: "dark" };
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored && ["light", "dark", "system"].includes(stored)) {
    const resolved = resolveTheme(stored);
    return { theme: stored, resolved };
  }
  return { theme: "dark", resolved: "dark" };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme().theme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getInitialTheme().resolved);

  // Apply class on mount (SSR renders "dark" default, this syncs)
  useEffect(() => {
    document.documentElement.className = resolvedTheme;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      document.documentElement.className = resolved;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    document.documentElement.className = resolved;
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
