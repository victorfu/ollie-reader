/**
 * Flow rules for the English homework book: where the learner is, the cloze
 * of a word's example, whether a sentence is acceptable, and how the
 * dictation scores.
 */
import type {
  Cloze,
  DictationItem,
  DictationResult,
  Homework,
  HomeworkWord,
  PageSection,
  WordPageProgress,
} from "../types/wordPractice";
import { isAnswerCorrect } from "./answerMatch";
import { makeCloze, sentenceUsesWord } from "./wordForms";

/** Times a learner copies a new word on its page. */
export const COPY_TARGET = 3;

/** Times a learner copies a wrongly spelled dictation word. */
export const CORRECTION_TARGET = 3;

const SENTENCE_MIN_WORDS = 4;

export type HomeworkPosition =
  | { phase: "page"; wordIndex: number; section: Exclude<PageSection, "done"> }
  | { phase: "dictation"; itemIndex: number }
  | { phase: "correction"; key: string }
  | { phase: "submit" };

const SECTION_ORDER: readonly PageSection[] = ["look", "copy", "recall", "cloze", "sentence", "done"];

export function emptyPage(): WordPageProgress {
  return { section: "look", copies: 0, sentence: null };
}

/**
 * The section a stored page is at. Homework saved before the phrase step was
 * replaced by the cloze can still say "phrase"; it continues at the cloze.
 */
export function pageSection(page: Pick<WordPageProgress, "section">): PageSection {
  const section: string = page.section;
  return section === "phrase" ? "cloze" : page.section;
}

/** The section after `section`; the cloze is skipped for a word that has none. */
export function nextSection(section: PageSection, hasCloze = true): PageSection {
  const index = SECTION_ORDER.indexOf(section);
  const next = SECTION_ORDER[Math.min(index + 1, SECTION_ORDER.length - 1)];
  return next === "cloze" && !hasCloze ? nextSection(next) : next;
}

/** The word's example sentence with every form of the word blanked, or null when it has none. */
export function clozeFor(word: Pick<HomeworkWord, "word" | "sentence">): Cloze | null {
  return word.sentence ? makeCloze(word.sentence, word.word) : null;
}

/** Whether `typed` is one of the forms blanked in the cloze. */
export function isClozeAnswer(typed: string, cloze: Cloze): boolean {
  return (cloze.answers ?? [cloze.answer]).some((answer) => isAnswerCorrect(typed, answer));
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
    const section = pageSection(hw.pages[wordIndex]) as Exclude<PageSection, "done">;
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

export function checkSentence(text: string, word: string): "ok" | "missingWord" | "tooShort" {
  if (!sentenceUsesWord(text, word)) return "missingWord";
  return countEnglishWords(text) < SENTENCE_MIN_WORDS ? "tooShort" : "ok";
}

export interface SentenceToReview {
  key: string;
  word: string;
  sentence: string;
}

/** Every new word's written sentence, in page order. */
export function sentencesToReview(hw: Pick<Homework, "newWords" | "pages">): SentenceToReview[] {
  return hw.newWords.flatMap((word, i) => {
    const sentence = hw.pages[i]?.sentence?.trim();
    return sentence ? [{ key: word.key, word: word.word, sentence }] : [];
  });
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
