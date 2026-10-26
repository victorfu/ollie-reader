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

/**
 * A param that is itself a dictionary entry. It is translated into the same
 * language as the sentence around it, so the Chinese hint of
 * "{scope}・錯題重練" gets a Chinese scope name, not the English one.
 */
export interface MessageRef {
  key: MessageKey;
  params?: MessageParams;
}

export type MessageParams = Record<string, string | number | MessageRef>;

/** Shorthand for a `MessageRef` param: `t("a", { scope: msg("b") })`. */
export const msg = (key: MessageKey, params?: MessageParams): MessageRef => ({
  key,
  params,
});

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
  return params ? interpolate(template, params, language) : template;
}

/**
 * Replace `{name}` with `params.name`; unknown placeholders stay visible.
 * `MessageRef` params are translated into `language`.
 */
export function interpolate(
  template: string,
  params: MessageParams,
  language: Language = "zh-TW",
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    const value = params[name];
    return typeof value === "object"
      ? translate(language, value.key, value.params)
      : String(value);
  });
}
