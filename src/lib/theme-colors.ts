"use client";

import { useState, useEffect } from "react";

const CSS_VARS = {
  accent: "--accent-primary",
  accentSecondary: "--accent-secondary",
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

// Chart color palette for multi-series data
export const CHART_COLORS = [
  "#d4a574", // accent
  "#7c9eb2", // blue-gray
  "#9b8bb4", // purple
  "#85b09a", // green
  "#c47d7d", // red
  "#b0a472", // olive
  "#7db4c4", // teal
  "#c49b7d", // tan
];
