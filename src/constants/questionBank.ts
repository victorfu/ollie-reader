/** Firestore collections（平鋪、每份文件帶 userId）。 */
export const QUESTION_SOURCES_COLLECTION = "questionSources";
export const BANK_QUESTIONS_COLLECTION = "bankQuestions";
export const EXAM_SHEETS_COLLECTION = "examSheets";

/** Supabase Storage 第一層資料夾；RLS 允許清單必須包含它（spec §15）。 */
export const QUESTION_BANK_STORAGE_FOLDER = "question-bank";

/** 一次上傳最多幾頁（照片＋PDF 展開後合計）。 */
export const MAX_SOURCE_PAGES = 30;
/** 單一檔案上限。 */
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

/** 存進 Storage 的頁面圖長邊。 */
export const PAGE_LONG_EDGE_PX = 2400;
/** 上傳前預覽縮圖的長邊。 */
export const THUMBNAIL_LONG_EDGE_PX = 240;
export const PAGE_JPEG_QUALITY = 0.85;

/** 寬或高小於這個值（0–1 座標）的框視為誤觸。 */
export const MIN_BOX_SIZE = 0.01;

export const AUTOSAVE_DELAY_MS = 1000;

export const SIGNED_URL_TTL_SECONDS = 3600;
/** 剩不到這麼久就視為過期、重新取得。 */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const FIRESTORE_BATCH_LIMIT = 500;

/**
 * 刻意不列 image/heic：accept 沒有 HEIC 時，iPhone Safari 會先把相簿照片
 * 轉成 JPEG 再交給網頁（spec §7）。
 */
export const ACCEPTED_UPLOAD_TYPES =
  "image/jpeg,image/png,image/webp,application/pdf";
