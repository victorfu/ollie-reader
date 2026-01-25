import type { TTSMode, TextParsingMode } from "./pdf";

export interface UserSettings {
  userId: string;
  ttsMode: TTSMode;
  speechRate?: number;
  textParsingMode?: TextParsingMode;
  createdAt?: Date;
  updatedAt?: Date;
}
