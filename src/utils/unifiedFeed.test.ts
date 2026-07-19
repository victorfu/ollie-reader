import { describe, expect, it } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";
import type { SentenceTranslation } from "../types/sentenceTranslation";
import {
  computeMergedFeed,
  feedItemKey,
  filterFeedItemsByType,
  groupFeedItemsByDate,
  type FeedItem,
} from "./unifiedFeed";

const word = (id: string, iso: string): VocabularyWord => ({
  id,
  word: id,
  userId: "u1",
  definitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
  createdAt: new Date(iso),
  updatedAt: new Date(iso),
  reviewCount: 0,
});

const sentence = (id: string, iso: string): SentenceTranslation => ({
  id,
  userId: "u1",
  english: `english ${id}`,
  chinese: `中文 ${id}`,
  createdAt: new Date(iso),
});

const keysOf = (items: FeedItem[]) => items.map(feedItemKey);

describe("computeMergedFeed", () => {
  it("merges fully loaded streams sorted newest first", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [word("w1", "2026-07-03T10:00:00Z"), word("w2", "2026-07-01T10:00:00Z")],
      wordsHasMore: false,
      sentences: [sentence("s1", "2026-07-02T10:00:00Z")],
      sentencesHasMore: false,
    });

    expect(keysOf(feed.items)).toEqual(["w-w1", "s-s1", "w-w2"]);
    expect(feed.hasMore).toBe(false);
    expect(feed.advance).toEqual([]);
  });

  it("buffers items older than the blocking stream's frontier", () => {
    // Words still paginating with oldest loaded at 07-10; the 07-05 sentence
    // must stay hidden until words advance past it.
    const feed = computeMergedFeed({
      filter: "all",
      words: [
        word("w1", "2026-07-30T00:00:00Z"),
        word("w2", "2026-07-20T00:00:00Z"),
        word("w3", "2026-07-10T00:00:00Z"),
      ],
      wordsHasMore: true,
      sentences: [
        sentence("s1", "2026-07-25T00:00:00Z"),
        sentence("s2", "2026-07-05T00:00:00Z"),
      ],
      sentencesHasMore: false,
    });

    expect(keysOf(feed.items)).toEqual(["w-w1", "s-s1", "w-w2", "w-w3"]);
    expect(feed.hasMore).toBe(true);
    expect(feed.advance).toEqual(["words"]);
  });

  it("advances only the stream owning the newest frontier", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [word("w1", "2026-07-10T00:00:00Z")],
      wordsHasMore: true,
      sentences: [sentence("s1", "2026-07-08T00:00:00Z")],
      sentencesHasMore: true,
    });

    expect(feed.advance).toEqual(["words"]);
    // Sentence at 07-08 is older than the words frontier (07-10) → buffered.
    expect(keysOf(feed.items)).toEqual(["w-w1"]);
  });

  it("advances both streams when their frontiers are equal", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [word("w1", "2026-07-10T00:00:00Z")],
      wordsHasMore: true,
      sentences: [sentence("s1", "2026-07-10T00:00:00Z")],
      sentencesHasMore: true,
    });

    expect(feed.advance).toEqual(["words", "sentences"]);
  });

  it("handles empty streams", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [],
      wordsHasMore: false,
      sentences: [],
      sentencesHasMore: false,
    });

    expect(feed.items).toEqual([]);
    expect(feed.hasMore).toBe(false);
    expect(feed.advance).toEqual([]);
  });

  it("hides everything while a pending stream has nothing loaded yet", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [],
      wordsHasMore: true,
      sentences: [sentence("s1", "2026-07-10T00:00:00Z")],
      sentencesHasMore: false,
    });

    expect(feed.items).toEqual([]);
    expect(feed.advance).toEqual(["words"]);
  });

  it("bypasses the frontier for single-type filters", () => {
    const words = [
      word("w1", "2026-07-30T00:00:00Z"),
      word("w2", "2026-07-01T00:00:00Z"),
    ];
    const sentences = [sentence("s1", "2026-07-15T00:00:00Z")];

    const wordsFeed = computeMergedFeed({
      filter: "words",
      words,
      wordsHasMore: true,
      sentences,
      sentencesHasMore: true,
    });
    expect(keysOf(wordsFeed.items)).toEqual(["w-w1", "w-w2"]);
    expect(wordsFeed.hasMore).toBe(true);
    expect(wordsFeed.advance).toEqual(["words"]);

    const sentencesFeed = computeMergedFeed({
      filter: "sentences",
      words,
      wordsHasMore: true,
      sentences,
      sentencesHasMore: false,
    });
    expect(keysOf(sentencesFeed.items)).toEqual(["s-s1"]);
    expect(sentencesFeed.hasMore).toBe(false);
    expect(sentencesFeed.advance).toEqual([]);
  });

  it("orders words before sentences on identical timestamps", () => {
    const feed = computeMergedFeed({
      filter: "all",
      words: [word("w1", "2026-07-10T00:00:00Z")],
      wordsHasMore: false,
      sentences: [sentence("s1", "2026-07-10T00:00:00Z")],
      sentencesHasMore: false,
    });

    expect(keysOf(feed.items)).toEqual(["w-w1", "s-s1"]);
  });
});

describe("filterFeedItemsByType", () => {
  it("filters mixed items by kind", () => {
    const items: FeedItem[] = [
      { kind: "word", word: word("w1", "2026-07-10T00:00:00Z") },
      { kind: "sentence", sentence: sentence("s1", "2026-07-09T00:00:00Z") },
    ];

    expect(keysOf(filterFeedItemsByType(items, "all"))).toEqual(["w-w1", "s-s1"]);
    expect(keysOf(filterFeedItemsByType(items, "words"))).toEqual(["w-w1"]);
    expect(keysOf(filterFeedItemsByType(items, "sentences"))).toEqual(["s-s1"]);
  });
});

describe("groupFeedItemsByDate", () => {
  it("groups by zh-TW calendar date preserving order", () => {
    const items: FeedItem[] = [
      { kind: "word", word: word("w1", "2026-07-10T02:00:00") },
      { kind: "sentence", sentence: sentence("s1", "2026-07-10T01:00:00") },
      { kind: "word", word: word("w2", "2026-07-09T10:00:00") },
    ];

    const groups = groupFeedItemsByDate(items);

    expect(groups).toHaveLength(2);
    expect(groups[0].items.map(feedItemKey)).toEqual(["w-w1", "s-s1"]);
    expect(groups[1].items.map(feedItemKey)).toEqual(["w-w2"]);
    expect(groups[0].date).not.toEqual(groups[1].date);
  });
});
