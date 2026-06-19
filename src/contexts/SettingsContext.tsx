import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserSettings, saveUserSettings } from "../services/settingsService";
import { SettingsContext } from "./SettingsContextType";
import type { UserSettings } from "../types/settings";
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../types/pdf";
import { getComputeMode, setComputeMode } from "../services/localBackend";

interface SettingsProviderProps {
  children: ReactNode;
}

const TEXT_PARSING_MODE_KEY = "ollie-reader-text-parsing-mode";
const SHOW_CHINESE_TRANSLATION_KEY = "ollie-reader-show-chinese-translation";

const getTextParsingModeFromStorage = (): TextParsingMode => {
  try {
    const stored = localStorage.getItem(TEXT_PARSING_MODE_KEY);
    if (stored === "frontend" || stored === "backend") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "backend"; // default to backend
};

const getShowChineseTranslationFromStorage = (): boolean => {
  try {
    const stored = localStorage.getItem(SHOW_CHINESE_TRANSLATION_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // localStorage not available
  }
  return false; // default: hide Chinese, show English-to-English
};

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>("piper");
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [readingMode, setReadingMode] = useState<ReadingMode>("word");
  const [textParsingMode, setTextParsingMode] = useState<TextParsingMode>(getTextParsingModeFromStorage);
  const [showChineseTranslation, setShowChineseTranslation] = useState<boolean>(
    getShowChineseTranslationFromStorage,
  );
  const [computeMode, setComputeModeState] = useState<ComputeMode>(getComputeMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setTtsMode("browser"); // Default when logged out
        setTtsEngine("piper"); // Default when logged out
        setSpeechRate(1); // Default when logged out
        setReadingMode("word"); // Default when logged out
        // textParsingMode is managed by localStorage, no need to reset
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const settings = await getUserSettings(user.uid);
        if (settings) {
          setTtsMode(settings.ttsMode);
          setTtsEngine(settings.ttsEngine ?? "piper");
          setSpeechRate(settings.speechRate ?? 1);
          setReadingMode(settings.readingMode ?? "word");
          // textParsingMode is managed by localStorage
        } else {
          // No settings found, use defaults
          setTtsMode("browser");
          setTtsEngine("piper");
          setSpeechRate(1);
          setReadingMode("word");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load settings";
        setError(message);
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [user]);

  // Generic setting update helper (for Firestore-synced settings)
  const updateSetting = useCallback(
    async <
      K extends keyof Pick<
        UserSettings,
        "ttsMode" | "ttsEngine" | "speechRate" | "readingMode"
      >,
    >(
      key: K,
      value: UserSettings[K],
      setter: (value: UserSettings[K]) => void,
    ): Promise<void> => {
      if (!user) {
        setError("User not authenticated");
        return;
      }

      setError(null);

      try {
        await saveUserSettings(user.uid, { [key]: value });
        setter(value);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update settings";
        setError(message);
        throw err;
      }
    },
    [user],
  );

  const updateTtsMode = useCallback(
    (mode: TTSMode) => updateSetting("ttsMode", mode, setTtsMode),
    [updateSetting],
  );

  const updateTtsEngine = useCallback(
    (engine: TTSEngine) =>
      updateSetting("ttsEngine", engine, (value) => {
        if (value) setTtsEngine(value as TTSEngine);
      }),
    [updateSetting],
  );

  const updateSpeechRate = useCallback(
    (rate: number) => updateSetting("speechRate", rate, (value) => {
      if (value !== undefined) {
        setSpeechRate(value);
      }
    }),
    [updateSetting],
  );

  const updateReadingMode = useCallback(
    (mode: ReadingMode) => updateSetting("readingMode", mode, (value) => {
      if (value !== undefined) {
        setReadingMode(value);
      }
    }),
    [updateSetting],
  );

  const updateTextParsingMode = useCallback(
    async (mode: TextParsingMode) => {
      // Save to localStorage only (local preference, not synced to Firestore)
      try {
        localStorage.setItem(TEXT_PARSING_MODE_KEY, mode);
      } catch {
        // localStorage not available
      }
      setTextParsingMode(mode);
    },
    [],
  );

  const updateShowChineseTranslation = useCallback((show: boolean) => {
    try {
      localStorage.setItem(SHOW_CHINESE_TRANSLATION_KEY, String(show));
    } catch {
      // localStorage not available
    }
    setShowChineseTranslation(show);
  }, []);

  const updateComputeMode = useCallback((mode: ComputeMode) => {
    setComputeMode(mode);
    setComputeModeState(mode);
  }, []);

  const value = useMemo(
    () => ({
      ttsMode,
      ttsEngine,
      speechRate,
      readingMode,
      textParsingMode,
      showChineseTranslation,
      computeMode,
      loading,
      error,
      updateTtsMode,
      updateTtsEngine,
      updateSpeechRate,
      updateReadingMode,
      updateTextParsingMode,
      updateShowChineseTranslation,
      updateComputeMode,
    }),
    [
      ttsMode,
      ttsEngine,
      speechRate,
      readingMode,
      textParsingMode,
      showChineseTranslation,
      computeMode,
      loading,
      error,
      updateTtsMode,
      updateTtsEngine,
      updateSpeechRate,
      updateReadingMode,
      updateTextParsingMode,
      updateShowChineseTranslation,
      updateComputeMode,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
