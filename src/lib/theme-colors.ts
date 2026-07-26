"use client";

import { useState, useEffect } from "react";

const CSS_VARS = {
  accent: "--accent-primary",
  accentSecondary: "--accent-primary-hover",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  bgBase: "--bg-base",
  bgSurface: "--bg-surface",
  bgElevated: "--bg-elevated",
  borderDefault: "--border-default",
  positive: "--accent-positive",
  negative: "--accent-negative",
} as const;

export type ThemeColors = Record<keyof typeof CSS_VARS, string>;

function resolveColors(): ThemeColors {
  if (typeof window === "undefined") {
    // SSR fallback
    return Object.fromEntries(
      Object.keys(CSS_VARS).map((k) => [k, "#888888"])
    ) as ThemeColors;
  }

  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(CSS_VARS).map(([key, cssVar]) => [
      key,
      style.getPropertyValue(cssVar).trim() || "#888888",
    ])
  ) as ThemeColors;
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(resolveColors);

  useEffect(() => {
    const resolve = () => setColors(resolveColors());

    // Resolve on mount (after hydration)
    resolve();

    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}

// Chart color palette — accent + cool neutrals (not all-brown)
export const CHART_COLORS = [
  "#8fb5f2", // accent blue
  "#6ba3d6", // steel blue
  "#a78bfa", // violet
  "#5ecf8a", // green
  "#f0a060", // coral
  "#9aa3b2", // cool gray
  "#e0b050", // gold
  "#7c9eb2", // slate
];
