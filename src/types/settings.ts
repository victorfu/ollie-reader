import type { TTSMode } from "./pdf";

export type TranslationApiType = "TRANSLATE_API_URL" | "FIREBASE_AI";

export interface UserSettings {
  userId: string;
  translationApi: TranslationApiType;
  ttsMode: TTSMode;
  speechRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
