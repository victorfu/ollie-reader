export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const API_URL = `${API_BASE_URL}/api/pdf/extract`;
export const TTS_API_URL = `${API_BASE_URL}/api/tts`; // Piper
export const KTTS_API_URL = `${API_BASE_URL}/api/ktts`; // Kokoro

// engine -> endpoint 對應。前端統一送 { text, speed, voice? }，後端各自轉換。
export const TTS_ENGINE_URL: Record<"piper" | "kokoro", string> = {
  piper: TTS_API_URL,
  kokoro: KTTS_API_URL,
};
export const VERSION_API_URL = `${API_BASE_URL}/api/version`;
export const OIKID_BOOKING_RECORDS_API_URL = `${API_BASE_URL}/api/oikid/booking-records`;

// Storage API endpoints (backend proxy to Supabase Storage)
export const STORAGE_UPLOAD_URL = `${API_BASE_URL}/storage/upload`;
export const STORAGE_DELETE_URL = `${API_BASE_URL}/storage/delete`;
export const STORAGE_SIGNED_URL = `${API_BASE_URL}/storage/signed-url`;

// 本機 sidecar（desktop app）base，與雲端 API_BASE_URL 並存
export const LOCAL_BASE_URL = "http://127.0.0.1:8765";

// 可走本機運算(compute-mode)的端點 path：pdf/tts/ktts/fetch-url。
// storage、oikid 永遠走雲端；translate 走 Gemini，前端未接後端。
export const TTS_ENGINE_PATH: Record<"piper" | "kokoro", string> = {
  piper: "/api/tts",
  kokoro: "/api/ktts",
};
export const FETCH_URL_PATH = "/api/fetch-url";
export const PDF_EXTRACT_PATH = "/api/pdf/extract";
export const VERSION_PATH = "/api/version";
