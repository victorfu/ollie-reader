import { createContext } from "react";
import type { TTSMode } from "../types/pdf";

export type SettingsContextValue = {
  ttsMode: TTSMode;
  speechRate: number;
  loading: boolean;
  error: string | null;
  updateTtsMode: (mode: TTSMode) => Promise<void>;
  updateSpeechRate: (rate: number) => Promise<void>;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);
