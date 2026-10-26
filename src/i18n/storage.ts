import type { LanguageMode } from "./translate";

export const LANGUAGE_STORAGE_KEY = "ollie-language";

/**
 * The stored language mode, or Chinese when none/invalid. Also read directly
 * by UI that renders outside LanguageProvider (the top-level ErrorBoundary).
 */
export const readStoredLanguageMode = (): LanguageMode => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "zh-TW" || stored === "en") return stored;
    // The retired "English + Chinese hints" mode is plain English now.
    if (stored === "en-hint") return "en";
  } catch {
    // localStorage unavailable
  }
  return "zh-TW";
};

export const writeStoredLanguageMode = (mode: LanguageMode): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable
  }
};
