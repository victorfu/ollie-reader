import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserSettings, saveUserSettings } from "../services/settingsService";
import { SettingsContext } from "./SettingsContextType";
import type { UserSettings } from "../types/settings";
import type { TTSMode, TextParsingMode } from "../types/pdf";

interface SettingsProviderProps {
  children: ReactNode;
}

const TEXT_PARSING_MODE_KEY = "ollie-reader-text-parsing-mode";

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

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [textParsingMode, setTextParsingMode] = useState<TextParsingMode>(getTextParsingModeFromStorage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setTtsMode("browser"); // Default when logged out
        setSpeechRate(1); // Default when logged out
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
          setSpeechRate(settings.speechRate ?? 1);
          // textParsingMode is managed by localStorage
        } else {
          // No settings found, use defaults
          setTtsMode("browser");
          setSpeechRate(1);
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
    async <K extends keyof Pick<UserSettings, "ttsMode" | "speechRate">>(
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

  const updateSpeechRate = useCallback(
    (rate: number) => updateSetting("speechRate", rate, (value) => {
      if (value !== undefined) {
        setSpeechRate(value);
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

  const value = useMemo(
    () => ({
      ttsMode,
      speechRate,
      textParsingMode,
      loading,
      error,
      updateTtsMode,
      updateSpeechRate,
      updateTextParsingMode,
    }),
    [ttsMode, speechRate, textParsingMode, loading, error, updateTtsMode, updateSpeechRate, updateTextParsingMode]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
