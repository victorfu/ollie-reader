import { createContext } from "react";
import type { TTSMode } from "../types/pdf";

export interface SpeechContextType {
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  isSpeaking: boolean;
  ttsMode: TTSMode;
  setTtsMode: (mode: TTSMode) => void;
  isLoadingAudio: boolean;
  speechSupported: boolean;
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export const SpeechContext = createContext<SpeechContextType | undefined>(
  undefined,
);
