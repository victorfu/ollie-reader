import { createContext } from "react";
import type {
  TTSMode,
  TTSEngine,
  ReadingMode,
  ComputeMode,
  VocabularyPanelMode,
} from "../types/pdf";

export type SettingsContextValue = {
  ttsMode: TTSMode;
  ttsEngine: TTSEngine;
  speechRate: number;
  readingMode: ReadingMode;
  showChineseTranslation: boolean;
  vocabularyPanelMode: VocabularyPanelMode;
  computeMode: ComputeMode;
  updateComputeMode: (mode: ComputeMode) => void;
  loading: boolean;
  error: string | null;
  updateTtsMode: (mode: TTSMode) => Promise<void>;
  updateTtsEngine: (engine: TTSEngine) => Promise<void>;
  updateSpeechRate: (rate: number) => Promise<void>;
  updateReadingMode: (mode: ReadingMode) => Promise<void>;
  updateShowChineseTranslation: (show: boolean) => void;
  updateVocabularyPanelMode: (mode: VocabularyPanelMode) => void;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);
