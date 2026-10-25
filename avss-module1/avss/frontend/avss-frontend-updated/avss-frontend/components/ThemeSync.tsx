"use client";
import { useEffect } from "react";

export const THEME_KEY = "avss-theme";
export const applyTheme = (theme: string) => {
  if (theme === "midnight") document.documentElement.dataset.theme = "midnight";
  else delete document.documentElement.dataset.theme;
};

// Re-applies the saved theme after navigation or reload.
export default function ThemeSync() {
  useEffect(() => {
    try { applyTheme(localStorage.getItem(THEME_KEY) ?? "dark"); } catch { /* storage unavailable */ }
  }, []);
  return null;
}
