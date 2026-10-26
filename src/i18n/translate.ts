import { en } from "./en";
import { zhTW, type MessageKey } from "./zh-TW";

export type { MessageKey };

/** A language the dictionaries are written in. */
export type Language = "zh-TW" | "en";

/**
 * What the user picked in Settings. "en-hint" renders English but keeps the
 * Chinese one tap away, so Ollie can get used to the English interface.
 */
export type LanguageMode = "zh-TW" | "en" | "en-hint";

export type MessageParams = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = {
  "zh-TW": zhTW,
  en,
};

/** The language actually displayed for a mode. */
export const languageForMode = (mode: LanguageMode): Language =>
  mode === "zh-TW" ? "zh-TW" : "en";

/**
 * Look up `key` in `language`, substituting `{name}` placeholders. Falls back
 * to the Chinese text, then to the key itself, so a gap never renders blank.
 */
export function translate(
  language: Language,
  key: MessageKey,
  params?: MessageParams,
): string {
  const template = DICTIONARIES[language][key] ?? zhTW[key] ?? key;
  return params ? interpolate(template, params) : template;
}

/** Replace `{name}` with `params.name`; unknown placeholders stay visible. */
export function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
