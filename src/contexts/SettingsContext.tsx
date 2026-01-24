import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { getUserSettings, saveUserSettings } from "../services/settingsService";
import { SettingsContext } from "./SettingsContextType";
import type { UserSettings } from "../types/settings";
import type { TTSMode } from "../types/pdf";

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const [ttsMode, setTtsMode] = useState<TTSMode>("browser");
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings when user logs in
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
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
          setTtsMode(settings.ttsMode);
          setSpeechRate(settings.speechRate ?? 1);
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

  // Generic setting update helper
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

  const value = useMemo(
    () => ({
      ttsMode,
      speechRate,
      loading,
      error,
      updateTtsMode,
      updateSpeechRate,
    }),
    [ttsMode, speechRate, loading, error, updateTtsMode, updateSpeechRate]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
