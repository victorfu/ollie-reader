import type { TTSMode, TTSEngine, ReadingMode } from "./pdf";

export interface UserSettings {
  userId: string;
  translationModel?: string | null;
  ttsMode: TTSMode;
  ttsEngine?: TTSEngine;
  speechRate?: number;
  readingMode?: ReadingMode;
  createdAt?: Date;
  updatedAt?: Date;
}
