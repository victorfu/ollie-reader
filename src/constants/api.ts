export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
export const API_URL = `${API_BASE_URL}/api/pdf/extract`;
export const TRANSLATE_API_URL = `${API_BASE_URL}/api/translate`;
export const FETCH_URL_API = `${API_BASE_URL}/api/fetch-url`;
export const TTS_API_URL = `${API_BASE_URL}/api/tts`;
export const VERSION_API_URL = `${API_BASE_URL}/api/version`;
export const OIKID_BOOKING_RECORDS_API_URL = `${API_BASE_URL}/api/oikid/booking-records`;
