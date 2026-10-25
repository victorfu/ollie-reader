/**
 * Generates a Word Practice homework from the user's vocabulary book, offline:
 * picks the new words, adds the review words that are due, snapshots each
 * word's definitions and example sentence, and stores the homework.
 * Nothing here calls Gemini.
 */
import type { VocabularyWord } from "../types/vocabulary";
import type { Cloze, DictationItem, Homework, HomeworkWord, WordPracticeState } from "../types/wordPractice";
import { shuffleArray } from "../utils/arrayUtils";
import { loadCefrTable, practiceForm, practiceKey, resolveCefr } from "../utils/cefr";
import { emptyPage } from "../utils/homeworkFlow";
import { dueReviewKeys } from "../utils/reviewSchedule";
import { makeCloze } from "../utils/wordForms";
import { getAllVocabularyWords } from "./vocabularyService";
import { createHomework, loadPracticeState, newHomeworkId } from "./wordPracticeStorage";
import { isEligibleWord, selectHomeworkWords } from "./wordPracticeSelection";

export type GenerateHomeworkResult = { status: "created"; homework: Homework } | { status: "empty" };

/** A homework word points back at its vocabulary record, so a word without an id cannot be practised. */
type PracticableWord = VocabularyWord & { id: string };

const isPracticable = (word: VocabularyWord): word is PracticableWord =>
  Boolean(word.id) && isEligibleWord(word);

/** The first vocabulary example that contains the word (any form of it), with its cloze. */
export function findExampleCloze(word: VocabularyWord): { sentence: string; cloze: Cloze } | null {
  for (const { sentence } of word.examples) {
    const cloze = makeCloze(sentence, word.word);
    if (cloze) return { sentence, cloze };
  }
  return null;
}

function toHomeworkWord(
  word: PracticableWord,
  state: WordPracticeState,
  cefr: HomeworkWord["cefr"],
): HomeworkWord {
  const key = practiceKey(word.word);
  const kept = Object.hasOwn(state.words, key) ? state.words[key].sentence : undefined;
  return {
    key,
    vocabularyId: word.id,
    word: word.word,
    ...(word.emoji ? { emoji: word.emoji } : {}),
    definitions: word.definitions
      // Stored records are not validated; keep the entries a learner can read.
      .filter((definition) => typeof definition?.definition === "string" && definition.definition.trim() !== "")
      .map(({ partOfSpeech, definition, definitionChinese }) => ({
        partOfSpeech: typeof partOfSpeech === "string" ? partOfSpeech : "",
        definition,
        ...(typeof definitionChinese === "string" && definitionChinese.trim() !== "" ? { definitionChinese } : {}),
      })),
    sentence: findExampleCloze(word)?.sentence ?? kept ?? null,
    cefr,
  };
}

export async function generateHomework(uid: string, now: number = Date.now()): Promise<GenerateHomeworkResult> {
  const vocabulary = await getAllVocabularyWords(uid);
  const state = await loadPracticeState(uid, now);
  const table = await loadCefrTable();

  const candidates = vocabulary.filter(isPracticable);
  const levelOf = (word: VocabularyWord) => resolveCefr(table, state.cefrEstimates, word.word);
  const snapshot = (word: PracticableWord): HomeworkWord =>
    // The practice form is the spelling graded, blanked and read aloud.
    toHomeworkWord({ ...word, word: practiceForm(table, word.word) }, state, levelOf(word));

  // Selection only returns members of `candidates`, all of which have an id.
  const newWords = (
    selectHomeworkWords({ words: candidates, state, levelOf, settings: state.settings }) as PracticableWord[]
  ).map(snapshot);

  const newKeys = new Set(newWords.map(({ key }) => key));
  // Take every due key first: deleted words must not use up the review limit.
  const dueSet = new Set(
    dueReviewKeys(state.words, now, Number.POSITIVE_INFINITY).filter((key) => !newKeys.has(key)),
  );
  const found = new Map<string, PracticableWord>();
  for (const word of candidates) {
    const key = practiceKey(word.word);
    if (dueSet.has(key) && !found.has(key)) found.set(key, word);
  }
  // A due word that was deleted from the vocabulary book is left out, then the limit applies.
  const reviewWords = [...dueSet]
    .filter((key) => found.has(key))
    .slice(0, Math.max(0, state.settings.reviewLimit))
    .map((key) => snapshot(found.get(key)!));

  if (newWords.length === 0 && reviewWords.length === 0) return { status: "empty" };

  const dictation: DictationItem[] = shuffleArray([
    ...newWords.map(({ key }): DictationItem => ({ key, source: "new", answer: null, skipped: false })),
    ...reviewWords.map(({ key }): DictationItem => ({ key, source: "review", answer: null, skipped: false })),
  ]);
  const homework: Homework = {
    version: 2,
    id: newHomeworkId(uid),
    status: "active",
    createdAt: now,
    newWords,
    reviewWords,
    pages: newWords.map(() => emptyPage()),
    dictation,
    corrections: {},
  };
  await createHomework(uid, homework);
  return { status: "created", homework };
}
