import { useCallback, useEffect, useState } from "react";
import {
  getShowAllGachaEntries,
  setShowAllGachaEntries,
  SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT,
  SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY,
} from "../services/gachaPreferences";

export function useShowAllGachaEntries() {
  const [showAllGachaEntries, setShowAllGachaEntriesState] = useState(
    getShowAllGachaEntries,
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === SHOW_ALL_GACHA_ENTRIES_STORAGE_KEY ||
        event.key === null
      ) {
        setShowAllGachaEntriesState(getShowAllGachaEntries());
      }
    };
    const handlePreferenceChange = () => {
      setShowAllGachaEntriesState(getShowAllGachaEntries());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT,
      handlePreferenceChange,
    );
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        SHOW_ALL_GACHA_ENTRIES_CHANGE_EVENT,
        handlePreferenceChange,
      );
    };
  }, []);

  const updateShowAllGachaEntries = useCallback((showAll: boolean) => {
    setShowAllGachaEntries(showAll);
    setShowAllGachaEntriesState(showAll);
  }, []);

  return { showAllGachaEntries, updateShowAllGachaEntries };
}
