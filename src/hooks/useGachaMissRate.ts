import { useCallback, useEffect, useState } from "react";
import {
  GACHA_MISS_RATE_CHANGE_EVENT,
  GACHA_MISS_RATE_STORAGE_KEY,
  getGachaMissRatePercent,
  setGachaMissRatePercent,
} from "../services/gachaPreferences";

export function useGachaMissRate() {
  const [gachaMissRatePercent, setGachaMissRatePercentState] = useState(
    getGachaMissRatePercent,
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GACHA_MISS_RATE_STORAGE_KEY || event.key === null) {
        setGachaMissRatePercentState(getGachaMissRatePercent());
      }
    };
    const handlePreferenceChange = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "number") {
        setGachaMissRatePercentState(event.detail);
        return;
      }
      setGachaMissRatePercentState(getGachaMissRatePercent());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      GACHA_MISS_RATE_CHANGE_EVENT,
      handlePreferenceChange,
    );
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        GACHA_MISS_RATE_CHANGE_EVENT,
        handlePreferenceChange,
      );
    };
  }, []);

  const updateGachaMissRatePercent = useCallback((value: number) => {
    setGachaMissRatePercentState(setGachaMissRatePercent(value));
  }, []);

  return { gachaMissRatePercent, updateGachaMissRatePercent };
}
