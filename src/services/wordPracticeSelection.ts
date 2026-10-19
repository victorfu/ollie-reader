import type { VocabularyWord } from "../types/vocabulary";
import type { CefrInfo, HomeworkOptions, WordPracticeState } from "../types/wordPractice";
import { cefrRank, practiceKey } from "../utils/cefr";

export interface SelectionInput {
  words: VocabularyWord[];
  state: WordPracticeState;
  levelOf: (word: VocabularyWord) => CefrInfo | null;
  options: HomeworkOptions;
}

/** Rank of a word without a CEFR level: after C2 (rank 5). */
const UNRATED_RANK = 6;

/** A word has to be findable inside a sentence, so clitics like "'s" never qualify. */
const STARTS_WITH_LETTER_OR_DIGIT = /^[\p{L}\p{N}]/u;

/**
 * A word can be practised when the learner can finish every step with it: it
 * has an English definition (step 4 shows it) and it can appear in a sentence
 * (step 5 checks the sentence contains it).
 */
export function isEligibleWord(word: VocabularyWord): boolean {
  return (
    STARTS_WITH_LETTER_OR_DIGIT.test(word.word.trim()) &&
    word.definitions.some(
      // Stored records are not validated, so an item or its text can be missing.
      (definition) => typeof definition?.definition === "string" && definition.definition.trim() !== "",
    )
  );
}

interface Candidate {
  word: VocabularyWord;
  key: string;
  missed: boolean;
  /** Epoch ms of the latest miss, -Infinity when unknown. Only read for missed words. */
  lastMissedAt: number;
  rank: number;
  /** Epoch ms; an invalid date counts as the newest. */
  createdAt: number;
  level: CefrInfo | null;
}

const compare = <T extends number | string>(a: T, b: T): number => (a < b ? -1 : a > b ? 1 : 0);

const createdAtOf = (word: VocabularyWord): number => {
  const time = word.createdAt.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/** Missed words first (newest miss first), then by CEFR rank; ties by createdAt, then key. */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.missed !== b.missed) return a.missed ? -1 : 1;
  const byPriority = a.missed ? compare(b.lastMissedAt, a.lastMissedAt) : compare(a.rank, b.rank);
  return byPriority || compare(a.createdAt, b.createdAt) || compare(a.key, b.key);
}

/**
 * Picks the words for a new homework (spec 7.2 and 7.3): practicable, not yet
 * learned words, missed ones first and then from A1 up to C2. A word that
 * was never missed is skipped when its list level is below `startLevel`.
 */
export function selectHomeworkWords({ words, state, levelOf, options }: SelectionInput): VocabularyWord[] {
  const earliestByKey = new Map<string, Candidate>();

  for (const word of words) {
    if (!isEligibleWord(word)) continue;
    const key = practiceKey(word.word);
    const practiced = Object.hasOwn(state.words, key) ? state.words[key] : undefined;
    if (typeof practiced?.learnedAt === "number") continue;

    const createdAt = createdAtOf(word);
    const known = earliestByKey.get(key);
    if (known && known.createdAt <= createdAt) continue;

    const level = levelOf(word);
    earliestByKey.set(key, {
      word,
      key,
      missed: (practiced?.missCount ?? 0) > 0,
      lastMissedAt: practiced?.lastMissedAt ?? Number.NEGATIVE_INFINITY,
      rank: level ? cefrRank(level.level) : UNRATED_RANK,
      createdAt,
      level,
    });
  }

  const startRank = cefrRank(options.startLevel);
  return [...earliestByKey.values()]
    .filter(({ missed, level }) => missed || level?.source !== "list" || cefrRank(level.level) >= startRank)
    .sort(compareCandidates)
    .slice(0, Math.max(0, options.wordCount))
    .map(({ word }) => word);
}
