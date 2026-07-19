/** A difficult word extracted from a translated sentence, with a short gloss. */
export interface SentenceKeyWord {
  word: string;
  meaning: string;
}

export interface SentenceTranslation {
  id?: string;
  userId: string;
  english: string;
  chinese: string;
  /** 1-3 difficult words picked by AI; absent on docs created before this field existed. */
  keyWords?: SentenceKeyWord[];
  sourcePdfName?: string;
  createdAt: Date;
}

export interface SentenceTranslationFilters {
  searchQuery?: string;
  sortBy?: "createdAt" | "english";
  sortOrder?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}

export interface SentenceTranslationResult {
  sentences: SentenceTranslation[];
  hasMore: boolean;
  lastDocId?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
