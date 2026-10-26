import { createContext } from "react";
import {
  translate,
  type Language,
  type LanguageMode,
  type MessageKey,
  type MessageParams,
} from "../i18n/translate";

export interface LanguageContextValue {
  /** The user's stored choice. */
  mode: LanguageMode;
  /** The language the interface is displayed in. */
  language: Language;
  /** True in "en-hint" mode: English text should offer its Chinese meaning. */
  showHints: boolean;
  setMode: (mode: LanguageMode) => void;
  /** Text in the display language. */
  t: (key: MessageKey, params?: MessageParams) => string;
  /** Text in Chinese regardless of mode, for hints. */
  tZh: (key: MessageKey, params?: MessageParams) => string;
}

const zh = (key: MessageKey, params?: MessageParams) =>
  translate("zh-TW", key, params);

/**
 * Defaults to plain Chinese rather than null so components rendered without a
 * LanguageProvider (unit tests, isolated previews) keep today's behaviour.
 */
export const LanguageContext = createContext<LanguageContextValue>({
  mode: "zh-TW",
  language: "zh-TW",
  showHints: false,
  setMode: () => {},
  t: zh,
  tZh: zh,
});
