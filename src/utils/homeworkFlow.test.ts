import { describe, expect, it } from "vitest";
import type { DictationItem, Homework, HomeworkWord, WordPageProgress } from "../types/wordPractice";
import {
  checkSentence,
  clozeFor,
  countEnglishWords,
  currentPosition,
  emptyPage,
  gradeDictation,
  isClozeAnswer,
  nextSection,
  wordForKey,
} from "./homeworkFlow";

const SKIP = Symbol("skip");

const done = (): WordPageProgress => ({ section: "done", copies: 3, sentence: "a b c d" });
const unanswered = (key: string): DictationItem => ({ key, source: "new", answer: null, skipped: false });
const answered = (key: string, answer = key): DictationItem => ({ key, source: "new", answer, skipped: false });
const skipped = (key: string): DictationItem => ({ key, source: "new", answer: null, skipped: true });
const items = (n: number): DictationItem[] => Array.from({ length: n }, (_, i) => unanswered(`w${i}`));

const word = (w: string): HomeworkWord => ({
  key: w.toLowerCase(),
  vocabularyId: w,
  word: w,
  definitions: [],
  sentence: null,
  cefr: null,
});

type Flow = Pick<Homework, "pages" | "dictation" | "corrections">;
const withWords = (hw: Flow, words: string[]) => ({
  ...hw,
  newWords: words.map(word),
  reviewWords: [] as HomeworkWord[],
});
const noWords = (hw: Flow) => withWords(hw, []);

const hwWith = (rows: [string, string | typeof SKIP][]) => ({
  newWords: rows.map(([w]) => word(w)),
  reviewWords: [] as HomeworkWord[],
  dictation: rows.map(([w, a]): DictationItem =>
    a === SKIP
      ? skipped(w.toLowerCase())
      : answered(w.toLowerCase(), a),
  ),
});

describe("currentPosition", () => {
  it("starts at the first section of the first unfinished page", () => {
    expect(
      currentPosition(
        noWords({ pages: [done(), { ...emptyPage(), section: "recall" }], dictation: items(2), corrections: {} }),
      ),
    ).toEqual({ phase: "page", wordIndex: 1, section: "recall" });
  });
  it("goes to the first unanswered dictation item once every page is done", () => {
    expect(
      currentPosition(noWords({ pages: [done()], dictation: [answered("a"), unanswered("b")], corrections: {} })),
    ).toEqual({ phase: "dictation", itemIndex: 1 });
  });
  it("starts with dictation when the homework has no new words", () => {
    expect(currentPosition(noWords({ pages: [], dictation: [unanswered("a")], corrections: {} }))).toEqual({
      phase: "dictation",
      itemIndex: 0,
    });
  });
  it("asks for corrections of wrong answers until each has 3 copies", () => {
    const hw = { pages: [], dictation: [answered("run", "rnu")], corrections: { run: 2 } };
    expect(currentPosition(withWords(hw, ["run"]))).toEqual({ phase: "correction", key: "run" });
    expect(currentPosition(withWords({ ...hw, corrections: { run: 3 } }, ["run"]))).toEqual({ phase: "submit" });
  });
  it("is ready to submit when every item was skipped", () => {
    expect(
      currentPosition(noWords({ pages: [], dictation: [skipped("a"), skipped("b")], corrections: {} })),
    ).toEqual({ phase: "submit" });
  });
  it("treats a correct answer as needing no correction", () => {
    expect(
      currentPosition(withWords({ pages: [], dictation: [answered("run")], corrections: {} }, ["run"])),
    ).toEqual({ phase: "submit" });
  });
  it("resumes a page saved at the old phrase step at the cloze step", () => {
    const legacy = { ...emptyPage(), section: "phrase" } as unknown as WordPageProgress;
    expect(currentPosition(noWords({ pages: [legacy], dictation: [], corrections: {} }))).toEqual({
      phase: "page",
      wordIndex: 0,
      section: "cloze",
    });
  });
});

describe("page helpers", () => {
  it("creates an empty page and walks the sections in order", () => {
    expect(emptyPage()).toEqual({ section: "look", copies: 0, sentence: null });
    expect(nextSection("look")).toBe("copy");
    expect(nextSection("copy")).toBe("recall");
    expect(nextSection("recall")).toBe("cloze");
    expect(nextSection("cloze")).toBe("sentence");
    expect(nextSection("sentence")).toBe("done");
    expect(nextSection("done")).toBe("done");
  });
  it("skips the cloze step for a word without a usable example", () => {
    expect(nextSection("recall", false)).toBe("sentence");
  });
  it("blanks the word in its example sentence, in the form it is written", () => {
    expect(clozeFor({ word: "run", sentence: "Yesterday I ran to school." })).toEqual({
      text: "Yesterday I _____ to school.",
      answer: "ran",
    });
    expect(clozeFor({ word: "run", sentence: null })).toBeNull();
    expect(clozeFor({ word: "run", sentence: "I like to swim." })).toBeNull();
  });
  it("accepts any blanked form, ignoring case and spaces", () => {
    const cloze = { text: "Dogs love to _____, and my dog _____ fast.", answer: "run", answers: ["run", "runs"] };
    expect(isClozeAnswer(" Run ", cloze)).toBe(true);
    expect(isClozeAnswer("runs", cloze)).toBe(true);
    expect(isClozeAnswer("ran", cloze)).toBe(false);
  });
  it("finds a word among new and review words", () => {
    const hw = { newWords: [word("run")], reviewWords: [word("jump")] };
    expect(wordForKey(hw, "jump").word).toBe("jump");
    expect(wordForKey(hw, "run").word).toBe("run");
  });
});

describe("text checks", () => {
  it("checks a sentence: the word, and at least 4 English words", () => {
    expect(checkSentence("The cat is curious.", "curious")).toBe("ok");
    expect(checkSentence("Curious cat.", "curious")).toBe("tooShort");
    expect(checkSentence("The cat is very funny.", "curious")).toBe("missingWord");
  });
  it("counts English words, ignoring punctuation and numbers", () => {
    expect(countEnglishWords("I don't know, 2 cats!")).toBe(4);
  });
});

describe("gradeDictation", () => {
  it("grades dictation: correct, wrong and skipped, ignoring case and spaces", () => {
    expect(gradeDictation(hwWith([["Apple", "apple "], ["river", "rivr"], ["moon", SKIP]]))).toEqual({
      correctKeys: ["apple"],
      wrongKeys: ["river"],
      skippedKeys: ["moon"],
      correctCount: 1,
      total: 2,
    });
  });
});
