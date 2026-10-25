/**
 * Flow rules for the English homework book: where the learner is, whether a
 * sentence is acceptable, and how the dictation scores.
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

const SENTENCE_MIN_WORDS = 4;

export type HomeworkPosition =
  | { phase: "page"; wordIndex: number; section: Exclude<PageSection, "done"> }
  | { phase: "dictation"; itemIndex: number }
  /** `key` is the dictation item id. */
  | { phase: "correction"; key: string }
  | { phase: "submit" };

const SECTION_ORDER: readonly PageSection[] = ["look", "copy", "recall", "form", "sentence", "done"];

export function emptyPage(): WordPageProgress {
  return { section: "look", copies: 0, sentence: null };
}

/**
 * The section a stored page is at. Homework saved while the page still had a
 * phrase or an example cloze step can say "phrase" or "cloze"; it continues
 * at the sentence.
 */
export function pageSection(page: Pick<WordPageProgress, "section">): PageSection {
  const section: string = page.section;
  return section === "phrase" || section === "cloze" ? "sentence" : page.section;
}

/** The section after `section`; the form step is only for a word saved as an inflected form. */
export function nextSection(section: PageSection, hasForm = false): PageSection {
  const index = SECTION_ORDER.indexOf(section);
  const next = SECTION_ORDER[Math.min(index + 1, SECTION_ORDER.length - 1)];
  return next === "form" && !hasForm ? nextSection(next) : next;
}

/** The spelling a word's sentence has to use: the inflected form when there is one. */
export function sentenceWord(word: Pick<HomeworkWord, "word" | "inflection">): string {
  return word.inflection?.form ?? word.word;
}

/**
 * The id of a dictation item, used in the result and the corrections. A word
 * saved as an inflected form is dictated twice, and its form item gets its own id.
 */
export function dictationId(item: Pick<DictationItem, "key" | "form">): string {
  return item.form ? `${item.key}#form` : item.key;
}

export function findDictationItem(hw: Pick<Homework, "dictation">, id: string): DictationItem | undefined {
  return hw.dictation.find((item) => dictationId(item) === id);
}

/** The spelling a dictation item asks for. */
export function dictationAnswer(
  hw: Pick<Homework, "newWords" | "reviewWords">,
  item: Pick<DictationItem, "key" | "form">,
): string {
  const word = wordForKey(hw, item.key);
  return item.form && word.inflection ? word.inflection.form : word.word;
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
  return !isAnswerCorrect(item.answer, dictationAnswer(hw, item));
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
    const id = dictationId(item);
    if (isWrong(hw, item) && (hw.corrections[id] ?? 0) < CORRECTION_TARGET) {
      return { phase: "correction", key: id };
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
    return sentence ? [{ key: word.key, word: sentenceWord(word), sentence }] : [];
  });
}

export function gradeDictation(
  hw: Pick<Homework, "newWords" | "reviewWords" | "dictation">,
): DictationResult {
  const correctKeys: string[] = [];
  const wrongKeys: string[] = [];
  const skippedKeys: string[] = [];
  for (const item of hw.dictation) {
    const id = dictationId(item);
    if (item.skipped) skippedKeys.push(id);
    else if (item.answer !== null && isAnswerCorrect(item.answer, dictationAnswer(hw, item))) {
      correctKeys.push(id);
    } else wrongKeys.push(id);
  }
  return {
    correctKeys,
    wrongKeys,
    skippedKeys,
    correctCount: correctKeys.length,
    total: correctKeys.length + wrongKeys.length,
  };
}

/**
 * Whether each dictated word was remembered: every item asked for it (the base
 * and, for an inflected word, the form) was written correctly. A word whose
 * items were all skipped is left out.
 */
export function wordOutcomes(
  hw: Pick<Homework, "dictation">,
  result: Pick<DictationResult, "wrongKeys">,
): { key: string; remembered: boolean }[] {
  const wrong = new Set(result.wrongKeys);
  const outcomes = new Map<string, boolean>();
  for (const item of hw.dictation) {
    if (item.skipped) continue;
    outcomes.set(item.key, (outcomes.get(item.key) ?? true) && !wrong.has(dictationId(item)));
  }
  return [...outcomes].map(([key, remembered]) => ({ key, remembered }));
}
