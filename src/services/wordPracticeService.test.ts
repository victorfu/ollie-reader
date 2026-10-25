import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";
import type { CefrLevel, Homework, PracticeSettings, WordPracticeState, WordPracticeWordState } from "../types/wordPractice";

const mocks = vi.hoisted(() => ({
  getAllVocabularyWords: vi.fn(),
  loadPracticeState: vi.fn(),
  newHomeworkId: vi.fn(),
  createHomework: vi.fn(),
  loadCefrTable: vi.fn(),
  generateGeminiContent: vi.fn(),
}));

vi.mock("./vocabularyService", () => ({ getAllVocabularyWords: mocks.getAllVocabularyWords }));
vi.mock("./wordPracticeStorage", () => ({
  loadPracticeState: mocks.loadPracticeState,
  newHomeworkId: mocks.newHomeworkId,
  createHomework: mocks.createHomework,
}));
vi.mock("./geminiClient", () => ({ generateGeminiContent: mocks.generateGeminiContent }));
vi.mock("../utils/cefr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/cefr")>()),
  loadCefrTable: mocks.loadCefrTable,
}));

import { findExampleCloze, generateHomework } from "./wordPracticeService";

const UID = "user-1";
const NOW = Date.UTC(2026, 9, 19, 8, 30);
const DAY = 24 * 60 * 60 * 1000;
const S5: PracticeSettings = { newWordCount: 2, reviewLimit: 10, startLevel: "A1" };

const TABLE = new Map<string, CefrLevel>([
  ["apple", "A1"],
  ["moon", "A1"],
  ["cat", "A2"],
  ["river", "B1"],
  ["mr.", "A1"],
]);

function makeWord(word: string, overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  return {
    id: `id-${word}`,
    word,
    userId: UID,
    definitions: [{ partOfSpeech: "noun", definition: `the meaning of ${word}` }],
    examples: [],
    synonyms: [],
    antonyms: [],
    tags: [],
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    updatedAt: new Date(Date.UTC(2026, 0, 1)),
    reviewCount: 0,
    ...overrides,
  };
}

const withExample = (word: string, sentence: string): VocabularyWord => makeWord(word, { examples: [{ sentence }] });

const due = (dueAt = NOW - DAY): WordPracticeWordState => ({ stage: 1, dueAt, missCount: 0, learnedAt: 1 });

function stateWith(
  words: Record<string, WordPracticeWordState> = {},
  extra: Partial<WordPracticeState> = {},
): WordPracticeState {
  return {
    schemaVersion: 2,
    activeHomeworkId: null,
    words,
    cefrEstimates: {},
    settings: S5,
    ...extra,
  };
}

function mockWords(words: VocabularyWord[], state: WordPracticeState = stateWith()): void {
  mocks.getAllVocabularyWords.mockResolvedValue(words);
  mocks.loadPracticeState.mockResolvedValue(state);
}

/** Generates a homework with exactly the new words `newWords`, plus the due review words `due`. */
async function created({
  newWords = ["river", "cat"],
  due: dueKeys = [],
  book,
}: { newWords?: string[]; due?: string[]; book?: string[] } = {}): Promise<{ homework: Homework }> {
  const names = book ?? [...newWords, ...dueKeys];
  const words = names.map((name) =>
    name === "river"
      ? makeWord("river", {
          examples: [{ sentence: "The river is long." }],
          definitions: [{ partOfSpeech: "noun", definition: "a long flow of water", definitionChinese: "河流" }],
        })
      : makeWord(name),
  );
  mockWords(
    words,
    stateWith(Object.fromEntries(dueKeys.map((key) => [key, due()])), {
      settings: { ...S5, newWordCount: newWords.length },
    }),
  );
  const result = await generateHomework(UID, NOW);
  if (result.status !== "created") throw new Error("expected a homework");
  return result;
}

describe("wordPracticeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCefrTable.mockResolvedValue(TABLE);
    mocks.newHomeworkId.mockReturnValue("homework-1");
    mocks.createHomework.mockResolvedValue(undefined);
    mockWords([]);
  });

  describe("findExampleCloze", () => {
    it("returns the first vocabulary example that contains the word, with its cloze", () => {
      const word = makeWord("ember", {
        examples: [{ sentence: "The fire was warm." }, { sentence: "An ember glowed." }, { sentence: "Another ember fell." }],
      });

      expect(findExampleCloze(word)).toEqual({
        sentence: "An ember glowed.",
        cloze: { text: "An _____ glowed.", answer: "ember" },
      });
    });

    it("accepts an inflected form of the word", () => {
      expect(findExampleCloze(withExample("run", "She ran home."))).toEqual({
        sentence: "She ran home.",
        cloze: { text: "She _____ home.", answer: "ran" },
      });
    });

    it("returns null when no example contains the word, or there are no examples", () => {
      expect(findExampleCloze(withExample("ember", "The fire was warm."))).toBeNull();
      expect(findExampleCloze(makeWord("ember"))).toBeNull();
    });
  });

  describe("generateHomework", () => {
    it("never calls Gemini", async () => {
      mockWords([makeWord("apple"), makeWord("zorb")]);
      await generateHomework(UID, NOW);
      expect(mocks.generateGeminiContent).not.toHaveBeenCalled();
    });

    it("reads the whole vocabulary book once", async () => {
      mockWords([makeWord("apple")]);
      await generateHomework(UID, NOW);
      expect(mocks.getAllVocabularyWords).toHaveBeenCalledTimes(1);
      expect(mocks.getAllVocabularyWords).toHaveBeenCalledWith(UID);
    });

    it("passes now to loadPracticeState", async () => {
      await generateHomework(UID, NOW);
      expect(mocks.loadPracticeState).toHaveBeenCalledWith(UID, NOW);
    });

    it("snapshots English and Chinese definitions and the first example that contains the word", async () => {
      const { homework } = await created();
      const river = homework.newWords.find((w) => w.word === "river");
      expect(river).toMatchObject({
        word: "river",
        key: "river",
        vocabularyId: "id-river",
        sentence: "The river is long.",
        definitions: [{ partOfSpeech: "noun", definition: "a long flow of water", definitionChinese: "河流" }],
        cefr: { level: "B1", source: "list" },
      });
    });

    it("omits definitionChinese when there is none, and drops unreadable definitions", async () => {
      mockWords([
        makeWord("apple", {
          definitions: [
            { partOfSpeech: "noun", definition: "  " },
            { partOfSpeech: "noun", definition: "a round fruit", definitionChinese: " " },
          ],
        }),
      ]);
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.newWords[0].definitions).toEqual([{ partOfSpeech: "noun", definition: "a round fruit" }]);
    });

    it("falls back to a sentence kept in the practice state, then to none", async () => {
      mockWords(
        [makeWord("apple"), makeWord("moon"), withExample("cat", "A cat sat.")],
        stateWith(
          { apple: { stage: 0, missCount: 1, needsPractice: true, sentence: "I ate an apple." } },
          { settings: { ...S5, newWordCount: 3 } },
        ),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      const sentences = Object.fromEntries(result.homework.newWords.map((w) => [w.word, w.sentence]));
      expect(sentences).toEqual({ apple: "I ate an apple.", moon: null, cat: "A cat sat." });
    });

    it("prefers a vocabulary example over the sentence kept in the state", async () => {
      mockWords(
        [withExample("apple", "An apple fell.")],
        stateWith({ apple: { stage: 0, missCount: 0, sentence: "I ate an apple." } }),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.newWords[0].sentence).toBe("An apple fell.");
    });

    it("builds a version 2 homework with a blank page per new word", async () => {
      const { homework } = await created();
      expect(homework).toMatchObject({
        version: 2,
        id: "homework-1",
        status: "active",
        createdAt: NOW,
        corrections: {},
        reviewWords: [],
      });
      expect(homework.newWords).toHaveLength(2);
      expect(homework.pages).toEqual(
        homework.newWords.map(() => ({ section: "look", copies: 0, sentence: null })),
      );
      expect(homework.dictation.map((i) => i.key).sort()).toEqual(["cat", "river"]);
      expect(homework.dictation.every((i) => i.source === "new" && i.answer === null && !i.skipped)).toBe(true);
      expect(mocks.createHomework).toHaveBeenCalledWith(UID, homework);
    });

    it("adds due review words to dictation, shuffled with the new words", async () => {
      const { homework } = await created({ due: ["apple", "moon"] });
      expect(homework.reviewWords.map((w) => w.key).sort()).toEqual(["apple", "moon"]);
      expect(homework.dictation.map((i) => i.key).sort()).toEqual(["apple", "cat", "moon", "river"]);
      expect(
        homework.dictation
          .filter((i) => i.source === "review")
          .map((i) => i.key)
          .sort(),
      ).toEqual(["apple", "moon"]);
      expect(homework.pages).toHaveLength(2);
    });

    it("limits review words to settings.reviewLimit, most overdue first", async () => {
      mockWords(
        [makeWord("apple"), makeWord("moon"), makeWord("cat")],
        stateWith(
          { apple: due(NOW - DAY), moon: due(NOW - 3 * DAY), cat: due(NOW - 2 * DAY) },
          { settings: { ...S5, reviewLimit: 2 } },
        ),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.reviewWords.map((w) => w.key)).toEqual(["moon", "cat"]);
    });

    it("does not let deleted due words use up the review limit", async () => {
      mockWords(
        [makeWord("apple")],
        stateWith(
          { ghost1: due(NOW - 5 * DAY), ghost2: due(NOW - 4 * DAY), apple: due(NOW - DAY) },
          { settings: { ...S5, newWordCount: 0, reviewLimit: 2 } },
        ),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.reviewWords.map((w) => w.key)).toEqual(["apple"]);
      expect(result.homework.dictation.map((i) => i.key)).toEqual(["apple"]);
    });

    it("does not add a word that is not due yet", async () => {
      mockWords(
        [makeWord("apple"), makeWord("moon")],
        stateWith({ apple: due(NOW + DAY) }, { settings: { ...S5, newWordCount: 1 } }),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.reviewWords).toEqual([]);
      expect(result.homework.newWords.map((w) => w.key)).toEqual(["moon"]);
    });

    it("makes a dictation-only homework when there are review words but no new words", async () => {
      const { homework } = await created({ newWords: [], due: ["apple"] });
      expect(homework.newWords).toEqual([]);
      expect(homework.pages).toEqual([]);
      expect(homework.dictation).toEqual([{ key: "apple", source: "review", answer: null, skipped: false }]);
    });

    it("leaves out a due review word that was deleted from the vocabulary book", async () => {
      const { homework } = await created({ due: ["ghost"], book: ["cat"], newWords: ["cat"] });
      expect(homework.reviewWords).toEqual([]);
      expect(homework.dictation.map((i) => i.key)).toEqual(["cat"]);
    });

    it("reports empty when the only due word was deleted and nothing is new", async () => {
      mockWords([], stateWith({ ghost: due() }));
      expect(await generateHomework(UID, NOW)).toEqual({ status: "empty" });
      expect(mocks.createHomework).not.toHaveBeenCalled();
    });

    it("reports empty when there is nothing new and nothing due", async () => {
      expect(await generateHomework(UID, NOW)).toEqual({ status: "empty" });
      expect(mocks.createHomework).not.toHaveBeenCalled();
    });

    it("skips words that cannot be practised", async () => {
      mockWords(
        [
          makeWord("no definition", { definitions: [{ partOfSpeech: "noun", definition: "  " }] }),
          makeWord("no id", { id: undefined }),
          makeWord("'s"),
          makeWord("apple"),
        ],
        stateWith({}, { settings: { ...S5, newWordCount: 10 } }),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.newWords.map((w) => w.word)).toEqual(["apple"]);
    });

    it("snapshots the clean form, but keeps the period of an abbreviation in the word list", async () => {
      mockWords([makeWord("river."), makeWord("Mr.")], stateWith({}, { settings: { ...S5, newWordCount: 5 } }));
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.newWords.map((w) => w.word).sort()).toEqual(["Mr.", "river"]);
    });

    it("does not offer a due review word as a new word as well", async () => {
      mockWords(
        [makeWord("apple"), makeWord("moon")],
        stateWith({ apple: due() }, { settings: { ...S5, newWordCount: 5 } }),
      );
      const result = await generateHomework(UID, NOW);
      if (result.status !== "created") throw new Error("expected a homework");
      expect(result.homework.newWords.map((w) => w.key)).toEqual(["moon"]);
      expect(result.homework.reviewWords.map((w) => w.key)).toEqual(["apple"]);
    });
  });
});
