import { createContext } from "react";
import type { TTSMode, TTSEngine } from "../types/pdf";

export interface SpeakOptions {
  /**
   * Reject `speakAsync` when system-voice playback fails instead of resolving
   * silently, so callers can offer a retry. Off by default.
   */
  reportErrors?: boolean;
}

export interface SpeechContextType {
  speechRate: number;
  isSpeaking: boolean;
  ttsMode: TTSMode;
  ttsEngine: TTSEngine;
  setTtsMode: (mode: TTSMode) => void;
  isLoadingAudio: boolean;
  /** Text passed to the most recent speak/speakAsync call; lets a button know it is the one playing. */
  speakingText: string | null;
  speechSupported: boolean;
  speak: (text: string) => void;
  speakAsync: (text: string, options?: SpeakOptions) => Promise<void>;
  stopSpeaking: () => void;
}

export const SpeechContext = createContext<SpeechContextType | undefined>(
  undefined,
);
