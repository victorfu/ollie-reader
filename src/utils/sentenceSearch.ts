import type { SentenceTranslation } from "../types/sentenceTranslation";

/**
 * Sentences whose English contains `searchText` (case-insensitive) or whose
 * Chinese contains it as written. Runs in memory so the caller can keep one
 * downloaded copy of the book and search it as often as it likes.
 */
export function filterSentenceTranslations(
  sentences: readonly SentenceTranslation[],
  searchText: string,
): SentenceTranslation[] {
  const trimmed = searchText.trim();
  const normalizedSearch = trimmed.toLocaleLowerCase("en-US");
  if (!normalizedSearch) return [];
  return sentences.filter(
    (sentence) =>
      sentence.english.toLocaleLowerCase("en-US").includes(normalizedSearch) ||
      sentence.chinese.includes(trimmed),
  );
}
