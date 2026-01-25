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
