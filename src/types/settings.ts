import type { TTSMode, ReadingMode, TextParsingMode } from "./pdf";

export interface UserSettings {
  userId: string;
  ttsMode: TTSMode;
  speechRate?: number;
  readingMode?: ReadingMode;
  textParsingMode?: TextParsingMode;
  createdAt?: Date;
  updatedAt?: Date;
}
