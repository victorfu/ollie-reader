import { describe, expect, it } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";
import type { CefrInfo, HomeworkOptions, WordPracticeState } from "../types/wordPractice";
import { isEligibleWord, selectHomeworkWords } from "./wordPracticeSelection";

const DAY = 24 * 60 * 60 * 1000;
const BASE_TIME = Date.UTC(2026, 0, 1);

function makeWord(word: string, dayOffset: number, overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  return {
    id: `id-${word}-${dayOffset}`,
    word,
    userId: "user-1",
    definitions: [{ partOfSpeech: "noun", definition: `the meaning of ${word}` }],
    examples: [],
    synonyms: [],
    antonyms: [],
    tags: [],
    createdAt: new Date(BASE_TIME + dayOffset * DAY),
    updatedAt: new Date(BASE_TIME + dayOffset * DAY),
    reviewCount: 0,
    ...overrides,
  };
}

const list = (level: CefrInfo["level"]): CefrInfo => ({ level, source: "list" });
const ai = (level: CefrInfo["level"]): CefrInfo => ({ level, source: "ai" });

function selectWords(
  words: VocabularyWord[],
  levels: Record<string, CefrInfo>,
  {
    state = {},
    options = {},
  }: {
    state?: Partial<WordPracticeState>;
    options?: Partial<HomeworkOptions>;
  } = {},
): VocabularyWord[] {
  return selectHomeworkWords({
    words,
    state: { activeHomeworkId: null, words: {}, cefrEstimates: {}, ...state },
    levelOf: (word) => levels[word.word] ?? null,
    options: { wordCount: 20, startLevel: "A1", ...options },
  });
}

const select = (...args: Parameters<typeof selectWords>): string[] =>
  selectWords(...args).map((word) => word.word);

describe("isEligibleWord", () => {
  it("accepts a word with at least one non-blank English definition", () => {
    const word = makeWord("apple", 0, {
      definitions: [
        { partOfSpeech: "noun", definition: "   " },
        { partOfSpeech: "noun", definition: "a round fruit" },
      ],
    });
    expect(isEligibleWord(word)).toBe(true);
  });

  it("rejects a word without any English definition", () => {
    expect(isEligibleWord(makeWord("apple", 0, { definitions: [] }))).toBe(false);
    expect(
      isEligibleWord(
        makeWord("apple", 0, {
          definitions: [{ partOfSpeech: "noun", definition: "  ", definitionChinese: "蘋果" }],
        }),
      ),
    ).toBe(false);
  });

  it("treats malformed stored definitions as missing instead of throwing", () => {
    const missingText = makeWord("apple", 0, {
      definitions: [{ partOfSpeech: "noun", definition: undefined as unknown as string }],
    });
    const nullText = makeWord("apple", 0, {
      definitions: [{ partOfSpeech: "noun", definition: null as unknown as string }],
    });
    const nonStringText = makeWord("apple", 0, {
      definitions: [{ partOfSpeech: "noun", definition: 42 as unknown as string }],
    });
    const nullItem = makeWord("apple", 0, { definitions: [null as unknown as VocabularyWord["definitions"][number]] });

    expect(isEligibleWord(missingText)).toBe(false);
    expect(isEligibleWord(nullText)).toBe(false);
    expect(isEligibleWord(nonStringText)).toBe(false);
    expect(isEligibleWord(nullItem)).toBe(false);
  });

  it("still accepts a word whose valid definition sits next to malformed ones", () => {
    const word = makeWord("apple", 0, {
      definitions: [
        null as unknown as VocabularyWord["definitions"][number],
        { partOfSpeech: "noun", definition: undefined as unknown as string },
        { partOfSpeech: "noun", definition: "a round fruit" },
      ],
    });

    expect(isEligibleWord(word)).toBe(true);
  });

  it("rejects clitic and punctuation-led entries that a sentence could never contain", () => {
    expect(isEligibleWord(makeWord("'m", 0))).toBe(false);
    expect(isEligibleWord(makeWord("'s", 0))).toBe(false);
    expect(isEligibleWord(makeWord("  -ing", 0))).toBe(false);
    expect(isEligibleWord(makeWord("   ", 0))).toBe(false);
  });

  it("accepts entries that start with a letter or digit after trimming", () => {
    expect(isEligibleWord(makeWord("  apple ", 0))).toBe(true);
    expect(isEligibleWord(makeWord("café", 0))).toBe(true);
    expect(isEligibleWord(makeWord("24/7", 0))).toBe(true);
  });
});

describe("selectHomeworkWords", () => {
  it("orders by level A1 to C2, then by createdAt, with AI estimates ranked and unrated words last", () => {
    const words = [
      makeWord("unrated", 0),
      makeWord("b1-old", 1),
      makeWord("a2-new", 5),
      makeWord("ai-a2", 4),
      makeWord("a1", 6),
      makeWord("c2", 2),
      makeWord("a2-old", 3),
      makeWord("b1-new", 7),
    ];
    const levels = {
      "b1-old": list("B1"),
      "b1-new": list("B1"),
      "a2-old": list("A2"),
      "a2-new": list("A2"),
      "ai-a2": ai("A2"),
      a1: list("A1"),
      c2: list("C2"),
    };

    expect(select(words, levels)).toEqual([
      "a1",
      "a2-old",
      "ai-a2",
      "a2-new",
      "b1-old",
      "b1-new",
      "c2",
      "unrated",
    ]);
  });

  it("puts missed, unlearned words first, newest miss first, even when they are B2", () => {
    const words = [makeWord("easy", 0), makeWord("missed-old", 1), makeWord("missed-new", 2), makeWord("also-easy", 3)];
    const levels = {
      easy: list("A1"),
      "also-easy": list("A1"),
      "missed-old": list("B2"),
      "missed-new": list("B2"),
    };
    const state = {
      words: {
        "missed-old": { missCount: 1, lastMissedAt: 1000 },
        "missed-new": { missCount: 3, lastMissedAt: 5000 },
      },
    };

    expect(select(words, levels, { state })).toEqual(["missed-new", "missed-old", "easy", "also-easy"]);
  });

  it("sorts a missed word without lastMissedAt after missed words that have one", () => {
    const words = [makeWord("no-time", 0), makeWord("timed", 1), makeWord("plain", 2)];
    const levels = { "no-time": list("A1"), timed: list("C2"), plain: list("A1") };
    const state = {
      words: {
        "no-time": { missCount: 2 },
        timed: { missCount: 1, lastMissedAt: 10 },
      },
    };

    expect(select(words, levels, { state })).toEqual(["timed", "no-time", "plain"]);
  });

  it("falls back to createdAt then key when missed words share a lastMissedAt", () => {
    const words = [makeWord("beta", 2), makeWord("alpha", 2), makeWord("gamma", 1)];
    const state = {
      words: {
        beta: { missCount: 1, lastMissedAt: 7 },
        alpha: { missCount: 1, lastMissedAt: 7 },
        gamma: { missCount: 1, lastMissedAt: 7 },
      },
    };

    expect(select(words, {}, { state })).toEqual(["gamma", "alpha", "beta"]);
  });

  it("falls back to createdAt then key when missed words all lack lastMissedAt", () => {
    const words = [makeWord("delta", 2), makeWord("charlie", 2), makeWord("echo", 1)];
    const state = {
      words: {
        delta: { missCount: 1 },
        charlie: { missCount: 4 },
        echo: { missCount: 2 },
      },
    };

    expect(select(words, {}, { state })).toEqual(["echo", "charlie", "delta"]);
  });

  it("excludes learned words, including words that were missed before being learned", () => {
    const words = [makeWord("learned", 0), makeWord("relearned", 1), makeWord("fresh", 2)];
    const levels = { learned: list("A1"), relearned: list("A1"), fresh: list("A1") };
    const state = {
      words: {
        learned: { missCount: 0, learnedAt: 100 },
        relearned: { missCount: 2, lastMissedAt: 50, learnedAt: 100 },
      },
    };

    expect(select(words, levels, { state })).toEqual(["fresh"]);
  });

  it("treats a word that was never practised as not missed and not learned", () => {
    const words = [makeWord("never-practised", 0)];

    expect(select(words, { "never-practised": list("A1") })).toEqual(["never-practised"]);
  });

  it("skips list-level words below startLevel unless they were missed, and keeps AI-estimated and unrated words", () => {
    const words = [
      makeWord("list-a1", 0),
      makeWord("missed-a1", 1),
      makeWord("ai-a1", 2),
      makeWord("unrated", 3),
      makeWord("list-a2", 4),
      makeWord("list-b1", 5),
    ];
    const levels = {
      "list-a1": list("A1"),
      "missed-a1": list("A1"),
      "ai-a1": ai("A1"),
      "list-a2": list("A2"),
      "list-b1": list("B1"),
    };
    const state = { words: { "missed-a1": { missCount: 1, lastMissedAt: 1 } } };

    expect(select(words, levels, { state, options: { startLevel: "A2" } })).toEqual([
      "missed-a1",
      "ai-a1",
      "list-a2",
      "list-b1",
      "unrated",
    ]);
  });

  it("excludes words without an English definition", () => {
    const words = [
      makeWord("no-definition", 0, { definitions: [] }),
      makeWord("blank-definition", 1, { definitions: [{ partOfSpeech: "noun", definition: " " }] }),
      makeWord("ok", 2),
    ];

    expect(select(words, {})).toEqual(["ok"]);
  });

  it("skips a record with malformed definitions instead of failing the whole selection", () => {
    const words = [
      makeWord("broken", 0, { definitions: [{ partOfSpeech: "noun", definition: undefined as unknown as string }] }),
      makeWord("hollow", 1, { definitions: [null as unknown as VocabularyWord["definitions"][number]] }),
      makeWord("ok", 2),
    ];

    expect(select(words, {})).toEqual(["ok"]);
  });

  it("excludes punctuation-led entries such as clitics", () => {
    const words = [makeWord("'m", 0), makeWord("'s", 1), makeWord("am", 2)];

    expect(select(words, { "'m": list("A1"), "'s": list("A1"), am: list("A1") })).toEqual(["am"]);
  });

  it("keeps only the earliest createdAt when two entries share a practiceKey", () => {
    const earlier = makeWord("run", 1);
    const later = makeWord("Run.", 5);
    const levels = { run: list("A1"), "Run.": list("A1") };

    expect(selectWords([earlier, later], levels)).toEqual([earlier]);
    expect(selectWords([later, earlier], levels)).toEqual([earlier]);
  });

  it("chooses among duplicates only from the eligible entries", () => {
    const withoutDefinition = makeWord("run", 1, { definitions: [] });
    const usable = makeWord("Run.", 5);

    expect(select([withoutDefinition, usable], {})).toEqual(["Run."]);
  });

  it("does not exceed wordCount and returns everything when fewer words are available", () => {
    const words = [makeWord("one", 0), makeWord("two", 1), makeWord("three", 2), makeWord("four", 3)];
    const levels = { one: list("A1"), two: list("A1"), three: list("A1"), four: list("A1") };

    expect(select(words, levels, { options: { wordCount: 3 } })).toEqual(["one", "two", "three"]);
    expect(select(words, levels, { options: { wordCount: 10 } })).toEqual(["one", "two", "three", "four"]);
    expect(select([], levels)).toEqual([]);
  });

  it("sorts a word with an invalid createdAt last within its level without throwing", () => {
    const words = [
      makeWord("broken-date", 0, { createdAt: new Date(Number.NaN) }),
      makeWord("dated-late", 9),
      makeWord("dated-early", 1),
    ];
    const levels = { "broken-date": list("B1"), "dated-late": list("B1"), "dated-early": list("B1") };

    expect(select(words, levels)).toEqual(["dated-early", "dated-late", "broken-date"]);
  });

  it("does not mutate its input", () => {
    const words = [makeWord("b", 2), makeWord("a", 1)];
    const snapshot = [...words];

    select(words, { a: list("A1"), b: list("A1") });

    expect(words).toEqual(snapshot);
  });
});
