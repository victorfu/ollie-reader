import type { TTSMode, TTSEngine, ReadingMode } from "./pdf";

export interface UserSettings {
  userId: string;
  ttsMode: TTSMode;
  ttsEngine?: TTSEngine;
  speechRate?: number;
  readingMode?: ReadingMode;
  createdAt?: Date;
  updatedAt?: Date;
}
