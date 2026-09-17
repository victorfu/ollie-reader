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

// Web 的 API 語音固定使用 Edge TTS，可透過桌面服務或雲端呼叫。
export type TTSEngine = "edge";

// 運算後端連線模式（per-device，存 localStorage，不同步 Firestore）
export type ComputeMode = "auto" | "local" | "cloud";

/** 生詞本面板呈現方式：浮動視窗，或停靠在閱讀區右側。 */
export type VocabularyPanelMode = "floating" | "docked";
