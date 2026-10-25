/**
 * Generates a Word Practice homework from the user's vocabulary book, offline:
 * picks the new words, adds the review words that are due, snapshots each
 * word's definitions and example sentence, and stores the homework. A word
 * saved as an inflected form ("ran") is practised as its base form ("run")
 * together with the saved form.
 * Nothing here calls Gemini.
 */
import type { VocabularyWord } from "../types/vocabulary";
import type { DictationItem, Homework, HomeworkWord, WordPracticeState } from "../types/wordPractice";
import { shuffleArray } from "../utils/arrayUtils";
import { loadCefrTable, practiceForm, practiceKey, resolveCefr, type CefrTable } from "../utils/cefr";
import { emptyPage } from "../utils/homeworkFlow";
import { inflectionOf } from "../utils/inflection";
import { dueReviewKeys } from "../utils/reviewSchedule";
import { sentenceUsesWord } from "../utils/wordForms";
import { getAllVocabularyWords } from "./vocabularyService";
import { createHomework, loadPracticeState, newHomeworkId } from "./wordPracticeStorage";
import { isEligibleWord, selectHomeworkWords } from "./wordPracticeSelection";

export type GenerateHomeworkResult = { status: "created"; homework: Homework } | { status: "empty" };

/** A homework word points back at its vocabulary record, so a word without an id cannot be practised. */
type PracticableWord = VocabularyWord & { id: string };

const isPracticable = (word: VocabularyWord): word is PracticableWord =>
  Boolean(word.id) && isEligibleWord(word);

/** The first vocabulary example that contains the word (any form of it). */
export function findExampleSentence(word: VocabularyWord): string | null {
  return word.examples.find(({ sentence }) => sentenceUsesWord(sentence, word.word))?.sentence ?? null;
}

type HomeworkInflection = NonNullable<HomeworkWord["inflection"]>;

/**
 * The word as it is practised: punctuation from the book dropped, and an
 * inflected form replaced by its base, with the form returned beside it.
 */
function toPracticeWord(
  table: CefrTable,
  word: PracticableWord,
): { word: PracticableWord; inflection: HomeworkInflection | null } {
  const spelling = practiceForm(table, word.word);
  const found = inflectionOf(
    table,
    spelling,
    word.definitions.map((definition) => (typeof definition?.partOfSpeech === "string" ? definition.partOfSpeech : "")),
  );
  return found
    ? { word: { ...word, word: found.base }, inflection: { form: found.form, kind: found.kind } }
    : { word: { ...word, word: spelling }, inflection: null };
}

function toHomeworkWord(
  word: PracticableWord,
  state: WordPracticeState,
  cefr: HomeworkWord["cefr"],
  inflection: HomeworkInflection | null,
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
    sentence: findExampleSentence(word) ?? kept ?? null,
    cefr,
    ...(inflection ? { inflection } : {}),
  };
}

export async function generateHomework(uid: string, now: number = Date.now()): Promise<GenerateHomeworkResult> {
  const vocabulary = await getAllVocabularyWords(uid);
  const state = await loadPracticeState(uid, now);
  const table = await loadCefrTable();

  // The practice form is the spelling graded, redacted and read aloud.
  const practised = vocabulary.filter(isPracticable).map((word) => toPracticeWord(table, word));
  const candidates = practised.map(({ word }) => word);
  // "ran" and "run" are one word now; the form goes with it whichever entry is picked.
  const inflections = new Map<string, HomeworkInflection>();
  for (const { word, inflection } of practised) {
    const key = practiceKey(word.word);
    if (inflection && !inflections.has(key)) inflections.set(key, inflection);
  }
  const levelOf = (word: VocabularyWord) => resolveCefr(table, state.cefrEstimates, word.word);
  const snapshot = (word: PracticableWord): HomeworkWord =>
    toHomeworkWord(word, state, levelOf(word), inflections.get(practiceKey(word.word)) ?? null);

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

  // A word saved as an inflected form is dictated twice: once for the base, once for the form.
  const itemsFor = (word: HomeworkWord, source: DictationItem["source"]): DictationItem[] => [
    { key: word.key, source, answer: null, skipped: false },
    ...(word.inflection ? [{ key: word.key, source, answer: null, skipped: false, form: true } as const] : []),
  ];
  const dictation: DictationItem[] = shuffleArray([
    ...newWords.flatMap((word) => itemsFor(word, "new")),
    ...reviewWords.flatMap((word) => itemsFor(word, "review")),
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
