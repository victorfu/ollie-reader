export type ExtractedPage = {
  page_number: number;
  text: string;
  text_length: number;
  /** Width of the rendered, rotated CropBox viewport in PDF points. */
  width?: number;
  /** Height of the rendered, rotated CropBox viewport in PDF points. */
  height?: number;
  /** Optional PyMuPDF-native word boxes. Older backends and caches omit this. */
  words?: PdfWord[];
};

export type PdfWord = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type ExtractResponse = {
  status: string;
  filename: string;
  total_pages: number;
  pages: ExtractedPage[];
};

export type ReadingMode = "word" | "selection";

export type TTSMode = "browser" | "api";

// API 模式下使用哪個後端 TTS 引擎（ttsMode === "api" 時生效）
// piper/kokoro 兩邊（雲端 + 本機 sidecar）都有；edge 目前只有本機 sidecar 提供
export type TTSEngine = "piper" | "kokoro" | "edge";

// 運算後端連線模式（per-device，存 localStorage，不同步 Firestore）
export type ComputeMode = "auto" | "local" | "cloud";
