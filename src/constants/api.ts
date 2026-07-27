import type { TTSEngine } from "../types/pdf";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const API_URL = `${API_BASE_URL}/api/pdf/extract`;
export const VERSION_API_URL = `${API_BASE_URL}/api/version`;
export const OIKID_BOOKING_RECORDS_PATH = "/api/oikid/booking-records";

// 本機 sidecar（desktop app）base，與雲端 API_BASE_URL 並存
export const LOCAL_BASE_URL = "http://127.0.0.1:8765";

// 可走本機運算（local/auto/cloud compute-mode）的端點 path：pdf/tts/ktts/etts/fetch-url/oikid。storage 改由前端直連 Supabase（見 utils/supabaseClient）。
// engine -> endpoint 對應。前端統一送 { text, speed, voice? }，後端各自轉換。
// 注意 /api/etts 目前只有本機 sidecar 有；compute-mode 走到雲端時會 404，
// 且刻意不做引擎降級，因此設定頁要標明它需要本機服務。
export const TTS_ENGINE_PATH: Record<TTSEngine, string> = {
  piper: "/api/tts",
  kokoro: "/api/ktts",
  edge: "/api/etts",
};
export const PDF_EXTRACT_PATH = "/api/pdf/extract";
export const FETCH_URL_PATH = "/api/fetch-url";
export const VERSION_PATH = "/api/version";
