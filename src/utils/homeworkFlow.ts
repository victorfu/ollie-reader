/**
 * Flow rules for the English homework book: where the learner is, whether a
 * phrase or sentence is acceptable, and how the dictation scores.
 */
import type {
  DictationItem,
  DictationResult,
  Homework,
  HomeworkWord,
  PageSection,
  WordPageProgress,
} from "../types/wordPractice";
import { isAnswerCorrect } from "./answerMatch";
import { sentenceUsesWord } from "./wordForms";

/** Times a learner copies a new word on its page. */
export const COPY_TARGET = 3;

/** Times a learner copies a wrongly spelled dictation word. */
export const CORRECTION_TARGET = 3;

const PHRASE_MIN_WORDS = 2;
const PHRASE_MAX_WORDS = 5;
const SENTENCE_MIN_WORDS = 4;

export type HomeworkPosition =
  | { phase: "page"; wordIndex: number; section: Exclude<PageSection, "done"> }
  | { phase: "dictation"; itemIndex: number }
  | { phase: "correction"; key: string }
  | { phase: "submit" };

const SECTION_ORDER: readonly PageSection[] = ["look", "copy", "recall", "phrase", "sentence", "done"];

export function emptyPage(): WordPageProgress {
  return { section: "look", copies: 0, phrase: null, sentence: null };
}

export function nextSection(section: PageSection): PageSection {
  const index = SECTION_ORDER.indexOf(section);
  return SECTION_ORDER[Math.min(index + 1, SECTION_ORDER.length - 1)];
}

export function wordForKey(
  hw: Pick<Homework, "newWords" | "reviewWords">,
  key: string,
): HomeworkWord {
  const found = hw.newWords.find((w) => w.key === key) ?? hw.reviewWords.find((w) => w.key === key);
  if (!found) throw new Error(`Unknown homework word: ${key}`);
  return found;
}

function isWrong(hw: Pick<Homework, "newWords" | "reviewWords">, item: DictationItem): boolean {
  if (item.skipped || item.answer === null) return false;
  return !isAnswerCorrect(item.answer, wordForKey(hw, item.key).word);
}

export function currentPosition(
  hw: Pick<Homework, "newWords" | "reviewWords" | "pages" | "dictation" | "corrections">,
): HomeworkPosition {
  const wordIndex = hw.pages.findIndex((p) => p.section !== "done");
  if (wordIndex !== -1) {
    const section = hw.pages[wordIndex].section as Exclude<PageSection, "done">;
    return { phase: "page", wordIndex, section };
  }

  const itemIndex = hw.dictation.findIndex((d) => !d.skipped && d.answer === null);
  if (itemIndex !== -1) return { phase: "dictation", itemIndex };

  for (const item of hw.dictation) {
    if (isWrong(hw, item) && (hw.corrections[item.key] ?? 0) < CORRECTION_TARGET) {
      return { phase: "correction", key: item.key };
    }
  }
  return { phase: "submit" };
}

const ENGLISH_WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

export function countEnglishWords(text: string): number {
  return text.match(ENGLISH_WORD)?.length ?? 0;
}

export function checkPhrase(text: string, word: string): "ok" | "missingWord" | "tooShort" | "tooLong" {
  if (!sentenceUsesWord(text, word)) return "missingWord";
  const count = countEnglishWords(text);
  if (count < PHRASE_MIN_WORDS) return "tooShort";
  if (count > PHRASE_MAX_WORDS) return "tooLong";
  return "ok";
}

export function checkSentence(text: string, word: string): "ok" | "missingWord" | "tooShort" {
  if (!sentenceUsesWord(text, word)) return "missingWord";
  return countEnglishWords(text) < SENTENCE_MIN_WORDS ? "tooShort" : "ok";
}

export function gradeDictation(
  hw: Pick<Homework, "newWords" | "reviewWords" | "dictation">,
): DictationResult {
  const correctKeys: string[] = [];
  const wrongKeys: string[] = [];
  const skippedKeys: string[] = [];
  for (const item of hw.dictation) {
    if (item.skipped) skippedKeys.push(item.key);
    else if (item.answer !== null && isAnswerCorrect(item.answer, wordForKey(hw, item.key).word)) {
      correctKeys.push(item.key);
    } else wrongKeys.push(item.key);
  }
  return {
    correctKeys,
    wrongKeys,
    skippedKeys,
    correctCount: correctKeys.length,
    total: correctKeys.length + wrongKeys.length,
  };
}
