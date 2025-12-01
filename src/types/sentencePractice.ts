export interface PracticeSentence {
  id?: string;
  english: string;
  chinese: string;
  userId: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SentencePracticeFilters {
  sortBy?: "createdAt" | "order";
  sortOrder?: "asc" | "desc";
  limit?: number;
  cursor?: string; // Last document ID for pagination
}

export interface SentencePracticeResult {
  sentences: PracticeSentence[];
  hasMore: boolean;
  lastDocId?: string;
}

export const DEFAULT_SENTENCE_PAGE_SIZE = 50;
