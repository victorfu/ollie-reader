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
