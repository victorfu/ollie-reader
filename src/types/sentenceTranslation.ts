export interface SentenceTranslation {
  id?: string;
  userId: string;
  english: string;
  chinese: string;
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
