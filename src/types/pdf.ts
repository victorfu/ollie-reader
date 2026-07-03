export type ExtractedPage = {
  page_number: number;
  text: string;
  text_length: number;
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
export type TTSEngine = "piper" | "kokoro" | "chatterbox";

// 文字解析模式
export type TextParsingMode = "frontend" | "backend";

// 運算後端連線模式（per-device，存 localStorage，不同步 Firestore）
export type ComputeMode = "auto" | "local" | "cloud";

// PDF 單字位置資訊
export interface WordPosition {
  word: string;
  x: number; // 相對於頁面的 x (已縮放)
  y: number; // 相對於頁面的 y (已縮放)
  width: number; // 估算寬度
  height: number; // 文字高度
}

// PDF 頁面尺寸資訊
export interface PageDimensions {
  originalWidth: number;
  originalHeight: number;
  scale: number; // pdfWidth / originalWidth
}
