import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserSettings, saveUserSettings } from "../services/settingsService";
import { SettingsContext } from "./SettingsContextType";
import type { TranslationApiType } from "../types/settings";
import type { TTSMode } from "../types/pdf";

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [translationApi, setTranslationApi] =
    useState<TranslationApiType>("FIREBASE_AI");
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setTranslationApi("FIREBASE_AI"); // Default when logged out
        setTtsMode("browser"); // Default when logged out
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
        } else {
          // No settings found, use defaults
          setTranslationApi("FIREBASE_AI");
          setTtsMode("browser");
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

  const updateTranslationApi = async (api: TranslationApiType) => {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    setError(null);

    try {
      await saveUserSettings(user.uid, { translationApi: api });
      setTranslationApi(api);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
      throw err;
    }
  };

  const updateTtsMode = async (mode: TTSMode) => {
    if (!user) {
      setError("User not authenticated");
      return;
    }

    setError(null);

    try {
      await saveUserSettings(user.uid, { ttsMode: mode });
      setTtsMode(mode);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        translationApi,
        ttsMode,
        loading,
        error,
        updateTranslationApi,
        updateTtsMode,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
