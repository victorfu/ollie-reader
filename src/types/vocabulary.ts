export interface VocabularyWord {
  id?: string;
  word: string;
  userId: string;

  // Word details
  phonetic?: string;
  emoji?: string;
  definitions: Definition[];
  examples: Example[];
  synonyms: string[];
  antonyms: string[];

  // Context from PDF
  sourceContext?: string;
  sourcePdfName?: string;
  sourcePage?: number;

  // Organization
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  reviewCount: number;
  lastReviewedAt?: Date;
}

export interface Definition {
  partOfSpeech: string; // noun, verb, adjective, etc.
  definition: string;
  definitionChinese?: string;
}

export interface Example {
  sentence: string;
  translation?: string;
}

export interface VocabularyGroup {
  date?: string;
  difficulty?: string;
  tag?: string;
  words: VocabularyWord[];
}

export interface VocabularyFilters {
  searchQuery?: string;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  sortBy?: "createdAt" | "word" | "reviewCount";
  sortOrder?: "asc" | "desc";
  limit?: number;
  cursor?: string; // Last document ID for pagination
}

export interface VocabularyResult {
  words: VocabularyWord[];
  hasMore: boolean;
  lastDocId?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
