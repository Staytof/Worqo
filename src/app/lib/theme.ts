import type { ThemePreference } from "../types";

export const THEME_STORAGE_KEY = "worqo-theme-preference-v1";

export function normalizeThemePreference(value: unknown): ThemePreference {
  return "light";
}

export function readThemePreference(): ThemePreference {
  return "light";
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Ignora falhas locais de armazenamento.
  }
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const body = document.body;

  root.classList.remove("dark");
  root.style.colorScheme = "light";

  if (body) {
    body.classList.remove("dark");
    body.style.colorScheme = "light";
  }
}
