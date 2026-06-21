import {
  FALLBACK_GAME_WORDS,
  type GameWordSeed,
} from "../../../services/gameWords.ts";

export const WORD_RUNNER_BEST_SCORE_KEY = "kaplay-word-runner-best";

export type GameWordToken = {
  id: string;
  word: string;
  definition: string;
  emoji: string;
  kind: "correct" | "distractor";
};

export type WordRunnerRound = {
  id: string;
  prompt: string;
  definition: string;
  options: GameWordToken[];
  correctOptionId: string;
};

export type WordRunnerResult = {
  score: number;
  bestScore: number;
  collected: number;
  missed: number;
  roundCount: number;
};

export function shouldStartWordRunnerGame({
  hasUser,
  vocabularyReady,
}: {
  hasUser: boolean;
  vocabularyReady: boolean;
}): boolean {
  return !hasUser || vocabularyReady;
}

export function compactRunnerText(value: string, maxLength = 24): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const chars = Array.from(normalized);

  if (chars.length <= maxLength) return normalized;

  return `${chars.slice(0, Math.max(0, maxLength - 1)).join("")}…`;
}

type NormalizedGameWord = {
  word: string;
  definition: string;
  emoji: string;
};

function normalizeWords(words: readonly GameWordSeed[]): NormalizedGameWord[] {
  const seen = new Set<string>();
  const normalized: NormalizedGameWord[] = [];

  for (const item of words) {
    const word = item.word.trim();
    const definition = item.def.trim();
    const key = word.toLowerCase();

    if (!word || !definition || seen.has(key)) continue;

    seen.add(key);
    normalized.push({
      word,
      definition,
      emoji: item.emoji || "✨",
    });
  }

  return normalized;
}

function buildWordPool(words: readonly GameWordSeed[]): NormalizedGameWord[] {
  const userWords = normalizeWords(words);
  const fallbackWords = normalizeWords(FALLBACK_GAME_WORDS).filter(
    (fallbackWord) =>
      !userWords.some(
        (userWord) =>
          userWord.word.toLowerCase() === fallbackWord.word.toLowerCase(),
      ),
  );

  if (userWords.length >= 3) return userWords;

  return [...userWords, ...fallbackWords];
}

function rotateOptions<T>(options: T[], roundIndex: number): T[] {
  if (options.length === 0) return options;

  const offset = roundIndex % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

export function buildWordRunnerRounds(
  words: readonly GameWordSeed[],
  count: number,
): WordRunnerRound[] {
  const roundCount = Math.max(0, Math.floor(count));
  const pool = buildWordPool(words);

  if (pool.length < 3 || roundCount === 0) return [];

  return Array.from({ length: roundCount }, (_, roundIndex) => {
    const correct = pool[roundIndex % pool.length];
    const distractors = pool
      .filter((word) => word.word.toLowerCase() !== correct.word.toLowerCase())
      .slice(0, 2);

    const options = rotateOptions(
      [
        {
          id: `${roundIndex}-${correct.word}-correct`,
          word: correct.word,
          definition: correct.definition,
          emoji: correct.emoji,
          kind: "correct" as const,
        },
        ...distractors.map((word, distractorIndex) => ({
          id: `${roundIndex}-${word.word}-distractor-${distractorIndex}`,
          word: word.word,
          definition: word.definition,
          emoji: word.emoji,
          kind: "distractor" as const,
        })),
      ],
      roundIndex,
    );

    return {
      id: `round-${roundIndex}-${correct.word.toLowerCase()}`,
      prompt: correct.word,
      definition: correct.definition,
      options,
      correctOptionId: `${roundIndex}-${correct.word}-correct`,
    };
  });
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getWordRunnerBestScore(storage = getStorage()): number {
  if (!storage) return 0;

  const stored = storage.getItem(WORD_RUNNER_BEST_SCORE_KEY);
  if (!stored) return 0;

  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function setWordRunnerBestScore(
  score: number,
  storage = getStorage(),
): number {
  if (!storage) return 0;

  const nextScore = Math.max(0, Math.floor(score));
  const currentBest = getWordRunnerBestScore(storage);
  const bestScore = Math.max(currentBest, nextScore);

  storage.setItem(WORD_RUNNER_BEST_SCORE_KEY, String(bestScore));

  return bestScore;
}
