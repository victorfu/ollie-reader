import { createContext } from "react";
import type { TTSMode, TextParsingMode } from "../types/pdf";

export type SettingsContextValue = {
  ttsMode: TTSMode;
  speechRate: number;
  textParsingMode: TextParsingMode;
  loading: boolean;
  error: string | null;
  updateTtsMode: (mode: TTSMode) => Promise<void>;
  updateSpeechRate: (rate: number) => Promise<void>;
  updateTextParsingMode: (mode: TextParsingMode) => Promise<void>;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);
