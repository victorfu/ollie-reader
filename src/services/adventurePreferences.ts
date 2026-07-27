import type { DefLanguage } from "../types/game";

export const ADVENTURE_DEF_LANGUAGE_STORAGE_KEY =
  "ollie-reader-adventure-def-language";
export const ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT =
  "ollie-reader:adventure-def-language-change";
export const DEFAULT_ADVENTURE_DEF_LANGUAGE: DefLanguage = "zh";

/** 單字大冒險的釋義語言偏好；認不得的儲存值一律回預設 */
export function getAdventureDefLanguage(): DefLanguage {
  if (typeof window === "undefined") return DEFAULT_ADVENTURE_DEF_LANGUAGE;

  try {
    const stored = window.localStorage.getItem(
      ADVENTURE_DEF_LANGUAGE_STORAGE_KEY,
    );
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }

  return DEFAULT_ADVENTURE_DEF_LANGUAGE;
}

export function setAdventureDefLanguage(lang: DefLanguage): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ADVENTURE_DEF_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // The setting still applies for this session when storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent<DefLanguage>(ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT, {
      detail: lang,
    }),
  );
}
