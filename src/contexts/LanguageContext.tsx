import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LanguageContext } from "./LanguageContextType";
import {
  languageForMode,
  translate,
  type LanguageMode,
  type MessageKey,
  type MessageParams,
} from "../i18n/translate";

export const LANGUAGE_STORAGE_KEY = "ollie-language";

const readStoredMode = (): LanguageMode => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "zh-TW" || stored === "en" || stored === "en-hint") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "zh-TW";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<LanguageMode>(readStoredMode);
  const language = languageForMode(mode);

  // Screen readers and the browser's hyphenation/fonts follow <html lang>.
  useEffect(() => {
    document.documentElement.lang = language === "zh-TW" ? "zh-Hant-TW" : "en";
  }, [language]);

  const setMode = useCallback((next: LanguageMode) => {
    setModeState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: MessageParams) =>
      translate(language, key, params),
    [language],
  );

  const tZh = useCallback(
    (key: MessageKey, params?: MessageParams) =>
      translate("zh-TW", key, params),
    [],
  );

  const value = useMemo(
    () => ({
      mode,
      language,
      showHints: mode === "en-hint",
      setMode,
      t,
      tZh,
    }),
    [mode, language, setMode, t, tZh],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
