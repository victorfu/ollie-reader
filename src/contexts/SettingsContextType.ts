import { createContext } from "react";
import type { TranslationApiType } from "../types/settings";
import type { TTSMode } from "../types/pdf";

export type SettingsContextValue = {
  translationApi: TranslationApiType;
  ttsMode: TTSMode;
  speechRate: number;
  loading: boolean;
  error: string | null;
  updateTranslationApi: (api: TranslationApiType) => Promise<void>;
  updateTtsMode: (mode: TTSMode) => Promise<void>;
  updateSpeechRate: (rate: number) => Promise<void>;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);
