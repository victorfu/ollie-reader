import { describe, expect, it } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";
import type { SentenceTranslation } from "../types/sentenceTranslation";
import type { FeedItem } from "./unifiedFeed";
import {
  findExactFeedItem,
  mergeFeedItems,
  searchFeedItems,
  stripEdgePunctuation,
  toSearchKey,
} from "./vocabularySearch";

const word = (id: string, text: string): FeedItem => ({
  kind: "word",
  word: { id, word: text } as VocabularyWord,
});

const sentence = (
  id: string,
  english: string,
  chinese = "",
  createdAt = new Date(0),
): FeedItem => ({
  kind: "sentence",
  sentence: { id, english, chinese, createdAt } as SentenceTranslation,
});

const texts = (items: FeedItem[]) =>
  items.map((item) =>
    item.kind === "word" ? item.word.word : item.sentence.english,
  );

describe("stripEdgePunctuation", () => {
  it("trims edge punctuation and collapses inner whitespace, keeping case", () => {
    expect(stripEdgePunctuation("  “Give   Up!” ")).toBe("Give Up");
    expect(stripEdgePunctuation("don't")).toBe("don't");
    expect(stripEdgePunctuation("well-known.")).toBe("well-known");
    expect(stripEdgePunctuation("...")).toBe("");
  });
});

describe("toSearchKey", () => {
  it("treats case, edge punctuation and spacing as the same entry", () => {
    expect(toSearchKey("I like  fruit.")).toBe("i like fruit");
    expect(toSearchKey("i like fruit")).toBe("i like fruit");
    expect(toSearchKey(" Curious? ")).toBe("curious");
  });
});

describe("searchFeedItems", () => {
  it("orders exact matches, then prefix matches, then other matches", () => {
    const items = [
      word("1", "incurious"),
      word("2", "curiously"),
      word("3", "curious"),
      word("4", "apple"),
    ];

    expect(texts(searchFeedItems(items, "curious"))).toEqual([
      "curious",
      "curiously",
      "incurious",
    ]);
  });

  it("matches sentences by English or Chinese and ranks them with words", () => {
    const items = [
      sentence("s1", "I like fruit.", "我喜歡水果。"),
      word("1", "fruity"),
      word("2", "grapefruit"),
      sentence("s2", "Fruit is sweet.", "水果很甜。"),
    ];

    expect(texts(searchFeedItems(items, "fruit"))).toEqual([
      "fruity",
      "Fruit is sweet.",
      "grapefruit",
      "I like fruit.",
    ]);
    expect(texts(searchFeedItems(items, "水果"))).toEqual([
      "I like fruit.",
      "Fruit is sweet.",
    ]);
  });

  it("ignores edge punctuation and case in the query", () => {
    const items = [word("1", "curious"), word("2", "apple")];
    expect(texts(searchFeedItems(items, "  CUR! "))).toEqual(["curious"]);
  });

  it("returns nothing for a query without letters or digits", () => {
    expect(searchFeedItems([word("1", "apple")], "?!")).toEqual([]);
  });
});

describe("findExactFeedItem", () => {
  it("finds a saved word regardless of case and edge punctuation", () => {
    const items = [word("1", "curiously"), word("2", "curious")];
    expect(findExactFeedItem(items, "Curious!")).toBe(items[1]);
  });

  it("finds a saved sentence typed without its final punctuation", () => {
    const items = [sentence("s1", "I like fruit.")];
    expect(findExactFeedItem(items, "i like  fruit")).toBe(items[0]);
  });

  it("prefers a saved phrase over a sentence with the same text", () => {
    const items = [sentence("s1", "Give up."), word("1", "give up")];
    expect(findExactFeedItem(items, "give up")).toBe(items[1]);
  });

  it("does not answer a single word with a one-word sentence", () => {
    expect(findExactFeedItem([sentence("s1", "Stop.")], "stop")).toBeNull();
  });

  it("returns null when only partial matches exist", () => {
    expect(findExactFeedItem([word("1", "curiously")], "curious")).toBeNull();
  });
});

describe("mergeFeedItems", () => {
  it("keeps the first copy of an item and appends new ones", () => {
    const local = word("1", "apple");
    const stale = word("1", "apple (stale)");
    const remote = word("2", "applause");

    expect(mergeFeedItems([local], [stale, remote])).toEqual([local, remote]);
  });
});
