import type { VocabularyWord } from "../types/vocabulary";
import type { SentenceTranslation } from "../types/sentenceTranslation";

/**
 * A single entry in the unified vocabulary feed — either a saved word or a
 * translated sentence. The two live in separate Firestore collections and are
 * merged client-side for display.
 */
export type FeedItem =
  | { kind: "word"; word: VocabularyWord }
  | { kind: "sentence"; sentence: SentenceTranslation };

export type FeedTypeFilter = "all" | "words" | "sentences";

export type FeedStream = "words" | "sentences";

/** Collision-proof React key across the two collections. */
export const feedItemKey = (item: FeedItem): string =>
  item.kind === "word"
    ? `w-${item.word.id ?? item.word.word}`
    : `s-${item.sentence.id ?? item.sentence.english}`;

export const feedItemDate = (item: FeedItem): Date =>
  item.kind === "word" ? item.word.createdAt : item.sentence.createdAt;

const compareFeedItemsDesc = (a: FeedItem, b: FeedItem): number => {
  const diff = feedItemDate(b).getTime() - feedItemDate(a).getTime();
  if (diff !== 0) return diff;
  // Deterministic tiebreak so re-renders keep a stable order
  if (a.kind !== b.kind) return a.kind === "word" ? -1 : 1;
  return feedItemKey(a).localeCompare(feedItemKey(b));
};

export const filterFeedItemsByType = (
  items: FeedItem[],
  filter: FeedTypeFilter,
): FeedItem[] =>
  filter === "all"
    ? items
    : items.filter((item) =>
        filter === "words" ? item.kind === "word" : item.kind === "sentence",
      );

export interface MergedFeed {
  /** Items safe to display right now, newest first. */
  items: FeedItem[];
  hasMore: boolean;
  /** Which stream(s) a load-more should advance to make progress. */
  advance: FeedStream[];
}

/**
 * Merge two independently cursor-paginated streams (both sorted createdAt
 * desc) into one display list without ever showing an item out of order.
 *
 * A stream that still has more pages only guarantees correct global order
 * down to its oldest loaded item (its "frontier") — anything older might be
 * interleaved with its unloaded pages. So with filter "all" we only display
 * items at or above the newest frontier; older loaded items stay buffered
 * until the blocking stream advances. `advance` names the blocking stream(s),
 * and each load-more strictly lowers that frontier (or exhausts the stream),
 * so pagination always terminates.
 */
export function computeMergedFeed(args: {
  filter: FeedTypeFilter;
  words: VocabularyWord[];
  wordsHasMore: boolean;
  sentences: SentenceTranslation[];
  sentencesHasMore: boolean;
}): MergedFeed {
  const { filter, words, wordsHasMore, sentences, sentencesHasMore } = args;

  const wordItems: FeedItem[] = words.map((word) => ({ kind: "word", word }));
  const sentenceItems: FeedItem[] = sentences.map((sentence) => ({
    kind: "sentence",
    sentence,
  }));

  if (filter === "words") {
    return {
      items: wordItems,
      hasMore: wordsHasMore,
      advance: wordsHasMore ? ["words"] : [],
    };
  }
  if (filter === "sentences") {
    return {
      items: sentenceItems,
      hasMore: sentencesHasMore,
      advance: sentencesHasMore ? ["sentences"] : [],
    };
  }

  // A fully loaded stream blocks nothing (-Infinity). A stream with more
  // pages but nothing loaded yet blocks everything (+Infinity).
  const streamFrontier = (
    loaded: FeedItem[],
    streamHasMore: boolean,
  ): number => {
    if (!streamHasMore) return Number.NEGATIVE_INFINITY;
    if (loaded.length === 0) return Number.POSITIVE_INFINITY;
    return feedItemDate(loaded[loaded.length - 1]).getTime();
  };

  const wordsFrontier = streamFrontier(wordItems, wordsHasMore);
  const sentencesFrontier = streamFrontier(sentenceItems, sentencesHasMore);
  const displayFrontier = Math.max(wordsFrontier, sentencesFrontier);

  const items = [...wordItems, ...sentenceItems]
    .filter((item) => feedItemDate(item).getTime() >= displayFrontier)
    .sort(compareFeedItemsDesc);

  const advance: FeedStream[] = [];
  if (wordsHasMore && wordsFrontier >= sentencesFrontier) {
    advance.push("words");
  }
  if (sentencesHasMore && sentencesFrontier >= wordsFrontier) {
    advance.push("sentences");
  }

  return { items, hasMore: wordsHasMore || sentencesHasMore, advance };
}

export interface FeedDateGroup {
  date: string;
  items: FeedItem[];
}

/** Group feed items by zh-TW calendar date, preserving input order. */
export const groupFeedItemsByDate = (items: FeedItem[]): FeedDateGroup[] => {
  const groups: FeedDateGroup[] = [];
  const indexByDate = new Map<string, number>();

  items.forEach((item) => {
    const date = feedItemDate(item).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const groupIndex = indexByDate.get(date);
    if (groupIndex === undefined) {
      indexByDate.set(date, groups.length);
      groups.push({ date, items: [item] });
    } else {
      groups[groupIndex].items.push(item);
    }
  });

  return groups;
};
