import type { MessageKey } from "./zh-TW";

/** English dictionary. Typed against the zh-TW keys so a missing entry fails tsc. */
export const en: Record<MessageKey, string> = {
  "settings.title": "Settings",
  "settings.category.appearance": "Appearance",
  "settings.category.audio": "Audio",
  "settings.category.advanced": "Advanced",
  "settings.category.game": "Games",

  "settings.theme.title": "Theme",
  "settings.theme.description": "Choose light or dark mode",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.system": "System",

  "settings.language.title": "Language",
  "settings.language.description":
    "Choose the interface language. “English＋中文提示” shows English; tap any underlined text to see the Chinese.",
  "settings.language.zh": "繁體中文",
  "settings.language.en": "English",
  "settings.language.enHint": "English＋中文提示",
};
