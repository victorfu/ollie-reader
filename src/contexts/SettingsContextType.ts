import { createContext } from "react";
import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode, ComputeMode } from "../types/pdf";

export type SettingsContextValue = {
  ttsMode: TTSMode;
  ttsEngine: TTSEngine;
  speechRate: number;
  readingMode: ReadingMode;
  textParsingMode: TextParsingMode;
  showChineseTranslation: boolean;
  computeMode: ComputeMode;
  updateComputeMode: (mode: ComputeMode) => void;
  loading: boolean;
  error: string | null;
  updateTtsMode: (mode: TTSMode) => Promise<void>;
  updateTtsEngine: (engine: TTSEngine) => Promise<void>;
  updateSpeechRate: (rate: number) => Promise<void>;
  updateReadingMode: (mode: ReadingMode) => Promise<void>;
  updateTextParsingMode: (mode: TextParsingMode) => Promise<void>;
  updateShowChineseTranslation: (show: boolean) => void;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);
