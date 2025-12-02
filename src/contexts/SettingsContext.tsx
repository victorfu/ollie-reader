import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserSettings, saveUserSettings } from "../services/settingsService";
import { SettingsContext } from "./SettingsContextType";
import type { TranslationApiType, UserSettings } from "../types/settings";
import type { TTSMode } from "../types/pdf";

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [translationApi, setTranslationApi] =
    useState<TranslationApiType>("FIREBASE_AI");
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setTranslationApi("FIREBASE_AI"); // Default when logged out
        setTtsMode("browser"); // Default when logged out
        setSpeechRate(1); // Default when logged out
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const settings = await getUserSettings(user.uid);
        if (settings) {
          setTranslationApi(settings.translationApi);
          setTtsMode(settings.ttsMode);
          setSpeechRate(settings.speechRate ?? 1);
        } else {
          // No settings found, use defaults
          setTranslationApi("FIREBASE_AI");
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

  // Generic setting update helper
  const updateSetting = useCallback(
    async <K extends keyof Pick<UserSettings, "translationApi" | "ttsMode" | "speechRate">>(
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

  const updateTranslationApi = useCallback(
    (api: TranslationApiType) => updateSetting("translationApi", api, setTranslationApi),
    [updateSetting],
  );

  const updateTtsMode = useCallback(
    (mode: TTSMode) => updateSetting("ttsMode", mode, setTtsMode),
    [updateSetting],
  );

  const updateSpeechRate = useCallback(
    (rate: number) => updateSetting("speechRate", rate, setSpeechRate as (value: number | undefined) => void),
    [updateSetting],
  );

  return (
    <SettingsContext.Provider
      value={{
        translationApi,
        ttsMode,
        speechRate,
        loading,
        error,
        updateTranslationApi,
        updateTtsMode,
        updateSpeechRate,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
