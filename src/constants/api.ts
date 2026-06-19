export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const API_URL = `${API_BASE_URL}/api/pdf/extract`;
export const FETCH_URL_API = `${API_BASE_URL}/api/fetch-url`;
export const TTS_API_URL = `${API_BASE_URL}/api/tts`; // Piper
export const KTTS_API_URL = `${API_BASE_URL}/api/ktts`; // Kokoro
export const GTTS_API_URL = `${API_BASE_URL}/api/gtts`; // Google Cloud TTS

// engine -> endpoint 對應。前端統一送 { text, speed, voice? }，後端各自轉換。
export const TTS_ENGINE_URL: Record<"piper" | "kokoro" | "google", string> = {
  piper: TTS_API_URL,
  kokoro: KTTS_API_URL,
  google: GTTS_API_URL,
};
export const VERSION_API_URL = `${API_BASE_URL}/api/version`;
export const OIKID_BOOKING_RECORDS_API_URL = `${API_BASE_URL}/api/oikid/booking-records`;

// GCS (Google Cloud Storage) API endpoints
export const GCS_UPLOAD_URL = `${API_BASE_URL}/gcs/upload`;
export const GCS_DELETE_URL = `${API_BASE_URL}/gcs/delete`;
export const GCS_SIGNED_URL = `${API_BASE_URL}/gcs/signed-url`;
