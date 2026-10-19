/**
 * Generates a Word Practice homework from the user's vocabulary book (spec 5.3
 * and 7): estimates CEFR levels the word list lacks, picks the words, prepares
 * one example sentence per word, and stores the homework snapshot.
 *
 * Gemini trouble (a failed estimate batch, no example sentences) never stops
 * generation. Only an abort does: `generateHomework` checks its signal after
 * every await and creates nothing once it has aborted.
 */
import type { VocabularyWord } from "../types/vocabulary";
import type { CefrLevel, Cloze, Homework, HomeworkOptions, HomeworkWord, WordPracticeState } from "../types/wordPractice";
import { loadCefrTable, lookupCefrLevel, practiceForm, practiceKey, resolveCefr, type CefrTable } from "../utils/cefr";
import { isAbortError } from "../utils/errorUtils";
import { emptyProgress } from "../utils/homeworkProgress";
import { logger } from "../utils/logger";
import { makeCloze } from "../utils/wordForms";
import { getAllVocabularyWords } from "./vocabularyService";
import { CEFR_ESTIMATE_BATCH_SIZE, estimateCefrLevels, generateExampleSentences } from "./wordPracticeAi";
import {
  createHomework,
  loadPracticeState,
  newHomeworkId,
  saveCefrEstimates,
  saveHomeworkWords,
} from "./wordPracticeStorage";
import { isEligibleWord, selectHomeworkWords } from "./wordPracticeSelection";

export type GenerateHomeworkResult = { status: "created"; homework: Homework } | { status: "empty" };

/** A homework word points back at its vocabulary record, so a word without an id cannot be practised. */
type PracticableWord = VocabularyWord & { id: string };

const isPracticable = (word: VocabularyWord): word is PracticableWord =>
  Boolean(word.id) && isEligibleWord(word);

const isLearned = (state: WordPracticeState, key: string): boolean =>
  Object.hasOwn(state.words, key) && typeof state.words[key].learnedAt === "number";

/** The first vocabulary example that contains the word (any form of it), with its cloze. */
export function findExampleCloze(word: VocabularyWord): { sentence: string; cloze: Cloze } | null {
  for (const { sentence } of word.examples) {
    const cloze = makeCloze(sentence, word.word);
    if (cloze) return { sentence, cloze };
  }
  return null;
}

/**
 * Estimates the CEFR level of every word that has neither a list level nor a
 * stored estimate, one batch at a time, and stores each batch as soon as it
 * comes back, so leaving the page half way keeps the estimates already paid
 * for. A failed batch is logged and skipped, so those words stay unrated until
 * the next try; a failed save is logged and does not stop the next batch.
 */
async function estimateMissingLevels(
  uid: string,
  words: VocabularyWord[],
  state: WordPracticeState,
  table: CefrTable,
  signal?: AbortSignal,
): Promise<Map<string, CefrLevel>> {
  const unrated = new Map<string, string>();
  for (const { word } of words) {
    const key = practiceKey(word);
    if (
      unrated.has(key) ||
      isLearned(state, key) ||
      Object.hasOwn(state.cefrEstimates, key) ||
      lookupCefrLevel(table, word) !== null
    ) {
      continue;
    }
    unrated.set(key, practiceForm(table, word));
  }

  const requested = [...unrated.values()];
  const estimates = new Map<string, CefrLevel>();
  for (let start = 0; start < requested.length; start += CEFR_ESTIMATE_BATCH_SIZE) {
    let batch: Record<string, CefrLevel> = {};
    try {
      batch = await estimateCefrLevels(requested.slice(start, start + CEFR_ESTIMATE_BATCH_SIZE), signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      logger.error("Could not estimate CEFR levels for a batch of words:", error);
    }
    signal?.throwIfAborted();
    if (Object.keys(batch).length > 0) {
      for (const [key, level] of Object.entries(batch)) estimates.set(key, level);
      try {
        await saveCefrEstimates(uid, batch);
      } catch (error) {
        logger.error("Could not save CEFR estimates:", error);
      }
    }
    signal?.throwIfAborted();
  }
  return estimates;
}

/** An example sentence for `word` that contains it, or null when `sentences` has none. */
function sentenceWithCloze(
  sentences: Record<string, string>,
  word: string,
): { sentence: string; cloze: Cloze } | null {
  const key = practiceKey(word);
  if (!Object.hasOwn(sentences, key)) return null;
  const sentence = sentences[key];
  const cloze = makeCloze(sentence, word);
  return cloze ? { sentence, cloze } : null;
}

function toHomeworkWord(
  word: PracticableWord,
  example: { sentence: string; cloze: Cloze } | null,
  cefr: HomeworkWord["cefr"],
): HomeworkWord {
  return {
    key: practiceKey(word.word),
    vocabularyId: word.id,
    word: word.word,
    ...(word.emoji ? { emoji: word.emoji } : {}),
    definitions: word.definitions
      // Stored records are not validated; keep the entries a learner can read.
      .filter((definition) => typeof definition?.definition === "string" && definition.definition.trim() !== "")
      .map(({ partOfSpeech, definition }) => ({
        partOfSpeech: typeof partOfSpeech === "string" ? partOfSpeech : "",
        definition,
      })),
    sentence: example?.sentence ?? null,
    cloze: example?.cloze ?? null,
    cefr,
  };
}

export async function generateHomework(
  uid: string,
  options: HomeworkOptions,
  signal?: AbortSignal,
): Promise<GenerateHomeworkResult> {
  signal?.throwIfAborted();
  const vocabulary = await getAllVocabularyWords(uid);
  signal?.throwIfAborted();
  const savedState = await loadPracticeState(uid);
  signal?.throwIfAborted();
  const table = await loadCefrTable();
  signal?.throwIfAborted();

  const candidates = vocabulary.filter(isPracticable);
  const estimates = await estimateMissingLevels(uid, candidates, savedState, table, signal);
  const state: WordPracticeState = {
    ...savedState,
    cefrEstimates: { ...savedState.cefrEstimates, ...Object.fromEntries(estimates) },
  };
  const levelOf = (word: VocabularyWord) => resolveCefr(table, state.cefrEstimates, word.word);

  // Selection only returns members of `candidates`, all of which have an id. Each one carries
  // its practice form from here on: that is the spelling graded, blanked and read aloud.
  const selected = (selectHomeworkWords({ words: candidates, state, levelOf, options }) as PracticableWord[]).map(
    (word) => ({ ...word, word: practiceForm(table, word.word) }),
  );
  if (selected.length === 0) return { status: "empty" };

  const examples = new Map(selected.map((word) => [word, findExampleCloze(word)]));
  const lacking = selected.filter((word) => examples.get(word) === null);
  if (lacking.length > 0) {
    try {
      const sentences = await generateExampleSentences(
        lacking.map(({ word }) => word),
        signal,
      );
      for (const word of lacking) examples.set(word, sentenceWithCloze(sentences, word.word));
    } catch (error) {
      if (isAbortError(error)) throw error;
      logger.error("Could not generate example sentences:", error);
    }
    signal?.throwIfAborted();
  }

  const words = selected.map((word) => toHomeworkWord(word, examples.get(word) ?? null, levelOf(word)));
  const homework: Homework = {
    id: newHomeworkId(uid),
    status: "active",
    createdAt: Date.now(),
    options,
    words,
    progress: emptyProgress(words.length),
  };
  await createHomework(uid, homework);
  return { status: "created", homework };
}

/**
 * Asks Gemini once for the words that still have no sentence, fills in the ones
 * that come back usable and stores them. Returns a new homework; the input is
 * not changed. Gemini errors propagate so the caller can tell the learner.
 */
export async function fillMissingSentences(
  uid: string,
  homework: Homework,
  signal?: AbortSignal,
): Promise<Homework> {
  signal?.throwIfAborted();
  const missing = homework.words.filter((word) => word.sentence === null);
  if (missing.length === 0) return homework;

  const sentences = await generateExampleSentences(
    missing.map(({ word }) => word),
    signal,
  );
  signal?.throwIfAborted();

  let changed = false;
  const words = homework.words.map((word) => {
    const example = word.sentence === null ? sentenceWithCloze(sentences, word.word) : null;
    if (!example) return word;
    changed = true;
    return { ...word, ...example };
  });
  if (!changed) return homework;

  await saveHomeworkWords(uid, homework.id, words);
  return { ...homework, words };
}
