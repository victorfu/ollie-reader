import { normalizeUniqueText } from "./firestoreIdentity";
import { feedItemKey, type FeedItem } from "./unifiedFeed";

// Strip punctuation around the input ("run." → "run") while keeping inner
// characters like hyphens and apostrophes intact.
const EDGE_PUNCTUATION_PATTERN = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Input text without edge punctuation or repeated spaces; case is kept. */
export const stripEdgePunctuation = (text: string): string =>
  text.trim().replace(EDGE_PUNCTUATION_PATTERN, "").replace(/\s+/g, " ");

/**
 * What makes two entries "the same" when searching the book: case, spacing
 * and surrounding punctuation are ignored, so "I like fruit" finds the saved
 * "I like fruit." instead of offering to add it again.
 */
export const toSearchKey = (text: string): string =>
  normalizeUniqueText(stripEdgePunctuation(text));

const feedItemText = (item: FeedItem): string =>
  item.kind === "word" ? item.word.word : item.sentence.english;

const EXACT = 0;
const PREFIX = 1;
const CONTAINS = 2;

const rankMatch = (item: FeedItem, key: string): number | null => {
  const itemKey = toSearchKey(feedItemText(item));
  if (itemKey === key) return EXACT;
  if (itemKey.startsWith(key)) return PREFIX;
  if (itemKey.includes(key)) return CONTAINS;
  if (item.kind === "sentence" && item.sentence.chinese.includes(key)) {
    return CONTAINS;
  }
  return null;
};

const compareSameRank = (a: FeedItem, b: FeedItem): number => {
  if (a.kind !== b.kind) return a.kind === "word" ? -1 : 1;
  if (a.kind === "word" && b.kind === "word") {
    return a.word.word.toLowerCase().localeCompare(b.word.word.toLowerCase());
  }
  if (a.kind === "sentence" && b.kind === "sentence") {
    return b.sentence.createdAt.getTime() - a.sentence.createdAt.getTime();
  }
  return 0;
};

/**
 * Saved items matching the query, best first: exact matches, then prefix
 * matches, then anything containing the query (including Chinese
 * translations). Words come before sentences of the same rank.
 */
export function searchFeedItems(items: FeedItem[], query: string): FeedItem[] {
  const key = toSearchKey(query);
  if (!key) return [];

  return items
    .map((item) => ({ item, rank: rankMatch(item, key) }))
    .filter((entry): entry is { item: FeedItem; rank: number } =>
      entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank || compareSameRank(a.item, b.item))
    .map((entry) => entry.item);
}

/**
 * The saved item the query names exactly, so submitting it can open the
 * entry instead of asking AI again. A phrase beats a sentence with the same
 * text, and a single word never resolves to a one-word sentence ("Stop.").
 */
export function findExactFeedItem(
  items: FeedItem[],
  query: string,
): FeedItem | null {
  const key = toSearchKey(query);
  if (!key) return null;

  const isSingleWord = !key.includes(" ");
  const matches = items.filter(
    (item) =>
      (item.kind === "word" || !isSingleWord) &&
      toSearchKey(feedItemText(item)) === key,
  );
  return matches.find((item) => item.kind === "word") ?? matches[0] ?? null;
}

/** Concatenate result lists, keeping the first copy of each item. */
export function mergeFeedItems(...lists: FeedItem[][]): FeedItem[] {
  const seen = new Set<string>();
  const merged: FeedItem[] = [];
  for (const item of lists.flat()) {
    const key = feedItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}
