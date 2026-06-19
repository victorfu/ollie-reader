import type { TTSMode, TTSEngine, ReadingMode, TextParsingMode } from "./pdf";

export interface UserSettings {
  userId: string;
  ttsMode: TTSMode;
  ttsEngine?: TTSEngine;
  speechRate?: number;
  readingMode?: ReadingMode;
  textParsingMode?: TextParsingMode;
  createdAt?: Date;
  updatedAt?: Date;
}
