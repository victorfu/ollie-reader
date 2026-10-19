import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyWord } from "../types/vocabulary";
import type { CefrLevel, Homework, HomeworkWord, WordPracticeState } from "../types/wordPractice";
import { isAnswerCorrect } from "../utils/answerMatch";
import { practiceKey } from "../utils/cefr";
import { emptyProgress } from "../utils/homeworkProgress";
import { makeCloze, redactWordForms, sentenceUsesWord } from "../utils/wordForms";

const mocks = vi.hoisted(() => ({
  getAllVocabularyWords: vi.fn(),
  loadPracticeState: vi.fn(),
  saveCefrEstimates: vi.fn(),
  newHomeworkId: vi.fn(),
  createHomework: vi.fn(),
  saveHomeworkWords: vi.fn(),
  estimateCefrLevels: vi.fn(),
  generateExampleSentences: vi.fn(),
  loadCefrTable: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("./vocabularyService", () => ({ getAllVocabularyWords: mocks.getAllVocabularyWords }));
vi.mock("./wordPracticeStorage", () => ({
  loadPracticeState: mocks.loadPracticeState,
  saveCefrEstimates: mocks.saveCefrEstimates,
  newHomeworkId: mocks.newHomeworkId,
  createHomework: mocks.createHomework,
  saveHomeworkWords: mocks.saveHomeworkWords,
}));
vi.mock("./wordPracticeAi", () => ({
  CEFR_ESTIMATE_BATCH_SIZE: 50,
  estimateCefrLevels: mocks.estimateCefrLevels,
  generateExampleSentences: mocks.generateExampleSentences,
}));
vi.mock("../utils/cefr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/cefr")>()),
  loadCefrTable: mocks.loadCefrTable,
}));
vi.mock("../utils/logger", () => ({ logger: { error: mocks.logError } }));

import { fillMissingSentences, findExampleCloze, generateHomework } from "./wordPracticeService";

const UID = "user-1";
const NOW = Date.UTC(2026, 9, 19, 8, 30);
const DAY = 24 * 60 * 60 * 1000;
const OPTIONS = { wordCount: 10, startLevel: "A1" } as const;

const TABLE = new Map<string, CefrLevel>([
  ["apple", "A1"],
  ["banana", "A2"],
  ["cat", "B1"],
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

const withExample = (word: string, sentence: string): VocabularyWord =>
  makeWord(word, { examples: [{ sentence }] });

function makeState(overrides: Partial<WordPracticeState> = {}): WordPracticeState {
  return { activeHomeworkId: null, words: {}, cefrEstimates: {}, ...overrides };
}

/** Words that are not in TABLE, so each one needs a CEFR estimate. */
const unlistedWords = (count: number): VocabularyWord[] =>
  Array.from({ length: count }, (_, index) => makeWord(`zorb${index}`, { createdAt: new Date(Date.UTC(2026, 0, 1) + index * DAY) }));

const estimateAs =
  (level: CefrLevel) =>
  async (words: string[]): Promise<Record<string, CefrLevel>> =>
    Object.fromEntries(words.map((word) => [practiceKey(word), level]));

function mockWords(words: VocabularyWord[], state: WordPracticeState = makeState()): void {
  mocks.getAllVocabularyWords.mockResolvedValue(words);
  mocks.loadPracticeState.mockResolvedValue(state);
}

const createdHomework = (): Homework => mocks.createHomework.mock.calls[0][1] as Homework;

describe("wordPracticeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mocks.loadCefrTable.mockResolvedValue(TABLE);
    mocks.newHomeworkId.mockReturnValue("homework-1");
    mocks.estimateCefrLevels.mockImplementation(estimateAs("B1"));
    mocks.generateExampleSentences.mockResolvedValue({});
    mocks.saveCefrEstimates.mockResolvedValue(undefined);
    mocks.createHomework.mockResolvedValue(undefined);
    mocks.saveHomeworkWords.mockResolvedValue(undefined);
    mockWords([]);
  });

  afterEach(() => {
    vi.useRealTimers();
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
      const word = withExample("run", "She ran home.");

      expect(findExampleCloze(word)).toEqual({
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
    describe("CEFR estimates", () => {
      it("estimates only practicable, unlearned words with no list level and no stored estimate", async () => {
        mockWords(
          [
            makeWord("apple"),
            makeWord("ember"),
            makeWord("Ember", { id: "id-Ember-duplicate" }),
            makeWord("cinder"),
            makeWord("pebble"),
            makeWord("no definition", { definitions: [{ partOfSpeech: "noun", definition: "  " }] }),
            makeWord("no id", { id: undefined }),
            makeWord("'s"),
          ],
          makeState({
            words: { cinder: { missCount: 0, learnedAt: 1 } },
            cefrEstimates: { pebble: "B2" },
          }),
        );
        const controller = new AbortController();

        await generateHomework(UID, OPTIONS, controller.signal);

        expect(mocks.estimateCefrLevels).toHaveBeenCalledTimes(1);
        expect(mocks.estimateCefrLevels).toHaveBeenCalledWith(["ember"], controller.signal);
      });

      it("does not call Gemini when every candidate already has a level", async () => {
        mockWords([makeWord("apple"), makeWord("ember")], makeState({ cefrEstimates: { ember: "C1" } }));

        await generateHomework(UID, OPTIONS);

        expect(mocks.estimateCefrLevels).not.toHaveBeenCalled();
        expect(mocks.saveCefrEstimates).not.toHaveBeenCalled();
      });

      it("sends 120 words in three sequential batches of 50, 50 and 20 and saves the estimates once", async () => {
        mockWords(unlistedWords(120));
        let inFlight = 0;
        let maxInFlight = 0;
        mocks.estimateCefrLevels.mockImplementation(async (words: string[]) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await Promise.resolve();
          inFlight -= 1;
          return estimateAs("B1")(words);
        });

        await generateHomework(UID, OPTIONS);

        const batches = mocks.estimateCefrLevels.mock.calls.map(([words]) => (words as string[]).length);
        expect(batches).toEqual([50, 50, 20]);
        expect(maxInFlight).toBe(1);
        expect(mocks.saveCefrEstimates).toHaveBeenCalledTimes(1);
        expect(Object.keys(mocks.saveCefrEstimates.mock.calls[0][1])).toHaveLength(120);
        expect(mocks.saveCefrEstimates.mock.calls[0][0]).toBe(UID);
      });

      it("keeps the other batches when one batch fails and saves only the successful estimates", async () => {
        mockWords(unlistedWords(120));
        const failure = new Error("rate limited");
        mocks.estimateCefrLevels
          .mockImplementationOnce(estimateAs("B1"))
          .mockRejectedValueOnce(failure)
          .mockImplementationOnce(estimateAs("B1"));

        const result = await generateHomework(UID, OPTIONS);

        expect(mocks.estimateCefrLevels).toHaveBeenCalledTimes(3);
        const saved = mocks.saveCefrEstimates.mock.calls[0][1] as Record<string, CefrLevel>;
        const batchTwo = (mocks.estimateCefrLevels.mock.calls[1][0] as string[]).map(practiceKey);
        expect(Object.keys(saved)).toHaveLength(70);
        expect(batchTwo.some((key) => key in saved)).toBe(false);
        expect(mocks.logError).toHaveBeenCalledWith(expect.any(String), failure);
        expect(result.status).toBe("created");
      });

      it("still creates the homework, with unrated words, when every batch fails", async () => {
        mockWords([makeWord("ember"), makeWord("apple")]);
        mocks.estimateCefrLevels.mockRejectedValue(new Error("quota exceeded"));

        const result = await generateHomework(UID, OPTIONS);

        expect(mocks.saveCefrEstimates).not.toHaveBeenCalled();
        expect(result.status).toBe("created");
        const words = createdHomework().words;
        expect(words.map((word) => [word.word, word.cefr])).toEqual([
          ["apple", { level: "A1", source: "list" }],
          ["ember", null],
        ]);
      });

      it("still creates the homework when saving the estimates fails", async () => {
        mockWords([makeWord("ember")]);
        const failure = new Error("offline");
        mocks.saveCefrEstimates.mockRejectedValue(failure);

        const result = await generateHomework(UID, OPTIONS);

        expect(mocks.logError).toHaveBeenCalledWith(expect.any(String), failure);
        expect(result.status).toBe("created");
        expect(createdHomework().words[0].cefr).toEqual({ level: "B1", source: "ai" });
      });

      it("lets the new estimates decide the selection order", async () => {
        mockWords([
          makeWord("ember", { createdAt: new Date(Date.UTC(2026, 0, 1)) }),
          makeWord("cinder", { createdAt: new Date(Date.UTC(2026, 0, 2)) }),
        ]);
        mocks.estimateCefrLevels.mockResolvedValue({ ember: "C2", cinder: "A1" });

        await generateHomework(UID, { wordCount: 1, startLevel: "A1" });

        expect(createdHomework().words.map((word) => [word.word, word.cefr])).toEqual([
          ["cinder", { level: "A1", source: "ai" }],
        ]);
      });
    });

    describe("example sentences", () => {
      it("uses a vocabulary example that contains the word and does not ask Gemini", async () => {
        mockWords([withExample("ember", "An ember glowed."), withExample("apple", "I ate an apple.")]);

        await generateHomework(UID, OPTIONS);

        expect(mocks.generateExampleSentences).not.toHaveBeenCalled();
        expect(createdHomework().words.map(({ word, sentence, cloze }) => ({ word, sentence, cloze }))).toEqual([
          { word: "apple", sentence: "I ate an apple.", cloze: { text: "I ate an _____.", answer: "apple" } },
          { word: "ember", sentence: "An ember glowed.", cloze: { text: "An _____ glowed.", answer: "ember" } },
        ]);
      });

      it("keeps every different form it blanks as an accepted answer and blanks possessives", async () => {
        mockWords([withExample("ember", "Embers glow, and this ember's light is warm.")]);

        await generateHomework(UID, OPTIONS);

        expect(createdHomework().words[0].cloze).toEqual({
          text: "_____ glow, and this _____'s light is warm.",
          answer: "Embers",
          answers: ["Embers", "ember"],
        });
      });

      it("asks for all missing sentences in one request and uses the ones that contain the word", async () => {
        mockWords([
          withExample("apple", "I ate an apple."),
          makeWord("banana"),
          makeWord("cat", { examples: [{ sentence: "The dog barked." }] }),
          makeWord("ember"),
        ]);
        mocks.generateExampleSentences.mockResolvedValue({
          banana: "A banana is yellow.",
          cat: "The cat sat on the mat.",
          ember: "The sky is blue.",
        });
        const controller = new AbortController();

        await generateHomework(UID, OPTIONS, controller.signal);

        expect(mocks.generateExampleSentences).toHaveBeenCalledTimes(1);
        expect(mocks.generateExampleSentences).toHaveBeenCalledWith(["banana", "cat", "ember"], controller.signal);
        const byWord = Object.fromEntries(createdHomework().words.map((word) => [word.word, word]));
        expect(byWord.apple.sentence).toBe("I ate an apple.");
        expect(byWord.banana).toMatchObject({
          sentence: "A banana is yellow.",
          cloze: { text: "A _____ is yellow.", answer: "banana" },
        });
        expect(byWord.cat).toMatchObject({
          sentence: "The cat sat on the mat.",
          cloze: { text: "The _____ sat on the mat.", answer: "cat" },
        });
        expect(byWord.ember).toMatchObject({ sentence: null, cloze: null });
      });

      it("leaves sentence and cloze null and still creates the homework when the request fails", async () => {
        mockWords([withExample("apple", "I ate an apple."), makeWord("banana"), makeWord("cat")]);
        const failure = new Error("quota exceeded");
        mocks.generateExampleSentences.mockRejectedValue(failure);

        const result = await generateHomework(UID, OPTIONS);

        expect(result.status).toBe("created");
        expect(mocks.logError).toHaveBeenCalledWith(expect.any(String), failure);
        expect(mocks.createHomework).toHaveBeenCalledTimes(1);
        expect(createdHomework().words.map(({ word, sentence, cloze }) => [word, sentence, cloze])).toEqual([
          ["apple", "I ate an apple.", { text: "I ate an _____.", answer: "apple" }],
          ["banana", null, null],
          ["cat", null, null],
        ]);
      });
    });

    describe("the created homework", () => {
      it("snapshots each word with English definitions only", async () => {
        mockWords([
          makeWord("apple", {
            emoji: "🍎",
            definitions: [
              { partOfSpeech: "noun", definition: "a round fruit", definitionChinese: "蘋果" },
              { partOfSpeech: "noun", definition: "   ", definitionChinese: "空白" },
              { partOfSpeech: "verb", definition: "to fruit", definitionChinese: "結果" },
            ],
          }),
          makeWord("banana", { emoji: "" }),
        ]);

        await generateHomework(UID, OPTIONS);

        const [apple, banana] = createdHomework().words;
        expect(apple).toMatchObject({ key: "apple", vocabularyId: "id-apple", word: "apple", emoji: "🍎" });
        expect(apple.definitions).toEqual([
          { partOfSpeech: "noun", definition: "a round fruit" },
          { partOfSpeech: "verb", definition: "to fruit" },
        ]);
        expect(apple.definitions.map((definition) => Object.keys(definition).sort())).toEqual([
          ["definition", "partOfSpeech"],
          ["definition", "partOfSpeech"],
        ]);
        expect("emoji" in banana).toBe(false);
      });

      it("writes options, createdAt, status, progress and each word's cefr", async () => {
        mockWords([makeWord("cat"), makeWord("ember"), makeWord("apple")], makeState({ cefrEstimates: { ember: "C1" } }));
        const options = { wordCount: 2, startLevel: "A2" } as const;

        const result = await generateHomework(UID, options);

        expect(mocks.createHomework).toHaveBeenCalledTimes(1);
        const [uid, homework] = mocks.createHomework.mock.calls[0] as [string, Homework];
        expect(uid).toBe(UID);
        expect(result).toEqual({ status: "created", homework });
        expect(homework).toMatchObject({ id: "homework-1", status: "active", createdAt: NOW, options });
        expect(mocks.newHomeworkId).toHaveBeenCalledWith(UID);
        expect(homework.words.map((word) => [word.word, word.cefr])).toEqual([
          ["cat", { level: "B1", source: "list" }],
          ["ember", { level: "C1", source: "ai" }],
        ]);
        expect(homework.progress).toEqual(emptyProgress(2));
        expect("completedAt" in homework).toBe(false);
        expect("result" in homework).toBe(false);
      });

      it("skips learned words and words that cannot be practised", async () => {
        mockWords(
          [
            makeWord("apple"),
            makeWord("banana"),
            makeWord("cat", { definitions: [] }),
            makeWord("ember", { id: undefined }),
          ],
          makeState({ words: { apple: { missCount: 1, learnedAt: 5 } } }),
        );

        await generateHomework(UID, OPTIONS);

        expect(createdHomework().words.map((word) => word.word)).toEqual(["banana"]);
      });

      it("picks a word that has an id over a duplicate without one", async () => {
        mockWords([
          makeWord("apple", { id: undefined, createdAt: new Date(Date.UTC(2025, 0, 1)) }),
          makeWord("Apple", { id: "id-second", createdAt: new Date(Date.UTC(2026, 0, 1)) }),
        ]);

        await generateHomework(UID, OPTIONS);

        expect(createdHomework().words).toHaveLength(1);
        expect(createdHomework().words[0]).toMatchObject({ word: "Apple", vocabularyId: "id-second" });
      });
    });

    describe("words saved with edge punctuation", () => {
      it("snapshots the clean form, so grading, sentences and blanks accept the plain word", async () => {
        mockWords([withExample("Run.", "I like to run fast.")]);

        await generateHomework(UID, OPTIONS);

        const [word] = createdHomework().words;
        expect(word).toMatchObject({
          key: "run",
          word: "Run",
          sentence: "I like to run fast.",
          cloze: { text: "I like to _____ fast.", answer: "run" },
        });
        expect(isAnswerCorrect("run", word.word)).toBe(true);
        expect(sentenceUsesWord("I run fast.", word.word)).toBe(true);
        expect(makeCloze("She ran home.", word.word)).toEqual({ text: "She _____ home.", answer: "ran" });
        expect(redactWordForms("To run is to move fast.", word.word, "____")).toBe("To ____ is to move fast.");
      });

      it("asks Gemini about the clean form and builds the cloze from the sentence it returns", async () => {
        mockWords([makeWord("hello,")]);
        mocks.generateExampleSentences.mockResolvedValue({ hello: "Hello, my friend." });

        await generateHomework(UID, OPTIONS);

        expect(mocks.estimateCefrLevels).toHaveBeenCalledWith(["hello"], undefined);
        expect(mocks.generateExampleSentences).toHaveBeenCalledWith(["hello"], undefined);
        expect(createdHomework().words[0]).toMatchObject({
          word: "hello",
          sentence: "Hello, my friend.",
          cloze: { text: "_____, my friend.", answer: "Hello" },
        });
      });

      it("keeps the period of an abbreviation that is a word list headword", async () => {
        mockWords([withExample("Mr.", "Mr. Lee is kind.")]);

        await generateHomework(UID, OPTIONS);

        expect(createdHomework().words[0]).toMatchObject({
          key: "mr",
          word: "Mr.",
          cefr: { level: "A1", source: "list" },
          cloze: { text: "_____ Lee is kind.", answer: "Mr." },
        });
      });

      it("uses the clean entry when a punctuated duplicate was saved earlier", async () => {
        mockWords([
          makeWord("river.", { id: "id-old", createdAt: new Date(Date.UTC(2025, 0, 1)) }),
          makeWord("river", { id: "id-new", createdAt: new Date(Date.UTC(2026, 0, 1)) }),
        ]);

        await generateHomework(UID, OPTIONS);

        expect(createdHomework().words.map((word) => [word.word, word.vocabularyId])).toEqual([["river", "id-new"]]);
      });
    });

    describe("nothing to practise", () => {
      it("returns empty without creating a homework when no word can be practised", async () => {
        mockWords([makeWord("apple"), makeWord("cat", { definitions: [] })], makeState({ words: { apple: { missCount: 0, learnedAt: 1 } } }));

        const result = await generateHomework(UID, OPTIONS);

        expect(result).toEqual({ status: "empty" });
        expect(mocks.createHomework).not.toHaveBeenCalled();
        expect(mocks.generateExampleSentences).not.toHaveBeenCalled();
      });

      it("returns empty for an empty vocabulary book", async () => {
        expect(await generateHomework(UID, OPTIONS)).toEqual({ status: "empty" });
        expect(mocks.createHomework).not.toHaveBeenCalled();
      });
    });

    describe("abort", () => {
      it("throws an AbortError and creates nothing when the signal is already aborted", async () => {
        mockWords([makeWord("apple")]);
        const controller = new AbortController();
        controller.abort();

        await expect(generateHomework(UID, OPTIONS, controller.signal)).rejects.toMatchObject({ name: "AbortError" });

        expect(mocks.createHomework).not.toHaveBeenCalled();
      });

      it("lets an AbortError from an estimate batch propagate", async () => {
        mockWords(unlistedWords(60));
        mocks.estimateCefrLevels.mockRejectedValue(new DOMException("Aborted", "AbortError"));

        await expect(generateHomework(UID, OPTIONS)).rejects.toMatchObject({ name: "AbortError" });

        expect(mocks.estimateCefrLevels).toHaveBeenCalledTimes(1);
        expect(mocks.createHomework).not.toHaveBeenCalled();
      });

      it("lets an AbortError from the sentence request propagate", async () => {
        mockWords([makeWord("apple")]);
        mocks.generateExampleSentences.mockRejectedValue(new DOMException("Aborted", "AbortError"));

        await expect(generateHomework(UID, OPTIONS)).rejects.toMatchObject({ name: "AbortError" });

        expect(mocks.createHomework).not.toHaveBeenCalled();
      });

      // Each step finishes after the signal aborts, as a call that ignores the signal would. The check right after
      // the await has to stop the flow there: no later step may start, and createHomework never runs.
      const steps = [
        ["reading the vocabulary book", mocks.getAllVocabularyWords, [makeWord("ember")]],
        ["reading the practice state", mocks.loadPracticeState, makeState()],
        ["loading the CEFR table", mocks.loadCefrTable, TABLE],
        ["estimating levels", mocks.estimateCefrLevels, { ember: "B1" }],
        ["saving the estimates", mocks.saveCefrEstimates, undefined],
        ["generating sentences", mocks.generateExampleSentences, { ember: "An ember glowed." }],
      ] as const;

      it.each(steps.map(([name], index) => [name, index] as const))(
        "stops at once when aborted while %s",
        async (_name, index) => {
          mockWords([makeWord("ember")]);
          const controller = new AbortController();
          const [, step, value] = steps[index];
          step.mockImplementationOnce(async () => {
            controller.abort();
            return value;
          });

          await expect(generateHomework(UID, OPTIONS, controller.signal)).rejects.toMatchObject({ name: "AbortError" });

          for (const [, laterStep] of steps.slice(index + 1)) expect(laterStep).not.toHaveBeenCalled();
          expect(mocks.createHomework).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe("fillMissingSentences", () => {
    const homeworkWord = (word: string, overrides: Partial<HomeworkWord> = {}): HomeworkWord => ({
      key: practiceKey(word),
      vocabularyId: `id-${word}`,
      word,
      definitions: [{ partOfSpeech: "noun", definition: `the meaning of ${word}` }],
      sentence: null,
      cloze: null,
      cefr: null,
      ...overrides,
    });

    const makeHomework = (words: HomeworkWord[]): Homework => ({
      id: "homework-9",
      status: "active",
      createdAt: NOW,
      options: OPTIONS,
      words,
      progress: emptyProgress(words.length),
    });

    it("asks once for the words without a sentence, fills them and saves the words", async () => {
      const homework = makeHomework([
        homeworkWord("apple", { sentence: "I ate an apple.", cloze: { text: "I ate an _____.", answer: "apple" } }),
        homeworkWord("banana"),
        homeworkWord("ember"),
        homeworkWord("cat"),
      ]);
      const before = structuredClone(homework);
      mocks.generateExampleSentences.mockResolvedValue({
        banana: "A banana is yellow.",
        ember: "The sky is blue.",
      });
      const controller = new AbortController();

      const result = await fillMissingSentences(UID, homework, controller.signal);

      expect(mocks.generateExampleSentences).toHaveBeenCalledTimes(1);
      expect(mocks.generateExampleSentences).toHaveBeenCalledWith(["banana", "ember", "cat"], controller.signal);
      expect(result.words.map(({ word, sentence, cloze }) => [word, sentence, cloze])).toEqual([
        ["apple", "I ate an apple.", { text: "I ate an _____.", answer: "apple" }],
        ["banana", "A banana is yellow.", { text: "A _____ is yellow.", answer: "banana" }],
        ["ember", null, null],
        ["cat", null, null],
      ]);
      expect(mocks.saveHomeworkWords).toHaveBeenCalledTimes(1);
      expect(mocks.saveHomeworkWords).toHaveBeenCalledWith(UID, "homework-9", result.words);
      expect(result).not.toBe(homework);
      expect({ ...result, words: before.words }).toEqual(before);
      expect(homework).toEqual(before);
    });

    it("returns the same homework without calling Gemini when no word lacks a sentence", async () => {
      const homework = makeHomework([
        homeworkWord("apple", { sentence: "I ate an apple.", cloze: { text: "I ate an _____.", answer: "apple" } }),
      ]);

      const result = await fillMissingSentences(UID, homework);

      expect(result).toBe(homework);
      expect(mocks.generateExampleSentences).not.toHaveBeenCalled();
      expect(mocks.saveHomeworkWords).not.toHaveBeenCalled();
    });

    it("saves nothing and returns the same homework when no usable sentence comes back", async () => {
      const homework = makeHomework([homeworkWord("banana"), homeworkWord("ember")]);
      mocks.generateExampleSentences.mockResolvedValue({ ember: "The sky is blue." });

      const result = await fillMissingSentences(UID, homework);

      expect(result).toBe(homework);
      expect(mocks.saveHomeworkWords).not.toHaveBeenCalled();
    });

    it("lets a Gemini error propagate and saves nothing", async () => {
      const homework = makeHomework([homeworkWord("banana")]);
      const failure = new Error("quota exceeded");
      mocks.generateExampleSentences.mockRejectedValue(failure);

      await expect(fillMissingSentences(UID, homework)).rejects.toBe(failure);

      expect(mocks.saveHomeworkWords).not.toHaveBeenCalled();
    });

    it("lets the save error propagate", async () => {
      const homework = makeHomework([homeworkWord("banana")]);
      const failure = new Error("offline");
      mocks.generateExampleSentences.mockResolvedValue({ banana: "A banana is yellow." });
      mocks.saveHomeworkWords.mockRejectedValue(failure);

      await expect(fillMissingSentences(UID, homework)).rejects.toBe(failure);
    });

    it("throws an AbortError without calling Gemini when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fillMissingSentences(UID, makeHomework([homeworkWord("banana")]), controller.signal),
      ).rejects.toMatchObject({ name: "AbortError" });

      expect(mocks.generateExampleSentences).not.toHaveBeenCalled();
    });

    it("does not save when aborted while the sentences are generated", async () => {
      const controller = new AbortController();
      mocks.generateExampleSentences.mockImplementation(async () => {
        controller.abort();
        return { banana: "A banana is yellow." };
      });

      await expect(
        fillMissingSentences(UID, makeHomework([homeworkWord("banana")]), controller.signal),
      ).rejects.toMatchObject({ name: "AbortError" });

      expect(mocks.saveHomeworkWords).not.toHaveBeenCalled();
    });
  });
});
