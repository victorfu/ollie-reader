import { useCallback, useEffect, useState } from "react";
import {
  getAdventureDefLanguage,
  setAdventureDefLanguage,
  ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT,
  ADVENTURE_DEF_LANGUAGE_STORAGE_KEY,
} from "../services/adventurePreferences";
import type { DefLanguage } from "../types/game";

export function useAdventureDefLanguage() {
  const [defLanguage, setDefLanguageState] = useState(getAdventureDefLanguage);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === ADVENTURE_DEF_LANGUAGE_STORAGE_KEY ||
        event.key === null
      ) {
        setDefLanguageState(getAdventureDefLanguage());
      }
    };
    const handlePreferenceChange = () => {
      setDefLanguageState(getAdventureDefLanguage());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT,
      handlePreferenceChange,
    );
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        ADVENTURE_DEF_LANGUAGE_CHANGE_EVENT,
        handlePreferenceChange,
      );
    };
  }, []);

  const updateDefLanguage = useCallback((lang: DefLanguage) => {
    setAdventureDefLanguage(lang);
    setDefLanguageState(lang);
  }, []);

  return { defLanguage, updateDefLanguage };
}
