import type { TTSMode } from "./pdf";

export interface UserSettings {
  userId: string;
  ttsMode: TTSMode;
  speechRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
