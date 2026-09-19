export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL?.trim() ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://server-one-xi-16.vercel.app"))
    .replace(/\/+$/, "");
export const ETTS_API_BASE_URL =
  (import.meta.env.VITE_ETTS_API_BASE_URL?.trim() || API_BASE_URL).replace(/\/+$/, "");
export const API_URL = `${API_BASE_URL}/api/pdf/extract`;
export const VERSION_API_URL = `${API_BASE_URL}/api/version`;
export const OIKID_BOOKING_RECORDS_PATH = "/api/oikid/booking-records";

// 本機 sidecar（desktop app）base，與雲端 API_BASE_URL 並存
export const LOCAL_BASE_URL = "http://127.0.0.1:8765";

// 可走本機運算（local/auto/cloud compute-mode）的端點 path：pdf/etts/fetch-url/oikid。storage 改由前端直連 Supabase（見 utils/supabaseClient）。
// Edge 的雲端請求使用 ETTS_API_BASE_URL；本機仍走 sidecar。
export const ETTS_PATH = "/api/etts";
export const PDF_EXTRACT_PATH = "/api/pdf/extract";
export const FETCH_URL_PATH = "/api/fetch-url";
export const VERSION_PATH = "/api/version";
