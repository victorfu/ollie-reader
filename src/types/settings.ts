import type { TTSMode } from "./pdf";

export type TranslationApiType =
  | "TRANSLATE_API_URL"
  | "ARGOS_TRANSLATE_API_URL"
  | "FIREBASE_AI";

export interface UserSettings {
  userId: string;
  translationApi: TranslationApiType;
  ttsMode: TTSMode;
  createdAt?: Date;
  updatedAt?: Date;
}
