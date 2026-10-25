import type {
  PracticeSettings,
  ReviewStage,
  WordPracticeWordState,
} from "../types/wordPractice";

const DAY_MS = 86_400_000;

export const REVIEW_INTERVAL_DAYS: readonly number[] = [1, 3, 7, 14, 30];

export const DEFAULT_SETTINGS: PracticeSettings = {
  newWordCount: 5,
  reviewLimit: 10,
  startLevel: "A1",
};

/** Drops undefined-valued fields, which Firestore rejects. */
function clean(state: WordPracticeWordState): WordPracticeWordState {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => value !== undefined),
  ) as unknown as WordPracticeWordState;
}

export function applyDictationOutcome(
  previous: WordPracticeWordState | undefined,
  outcome: "correct" | "wrong" | "skipped",
  now: number,
): WordPracticeWordState {
  if (outcome === "skipped") {
    return previous ?? { stage: 0, missCount: 0 };
  }
  const base: WordPracticeWordState = previous ?? { stage: 0, missCount: 0 };
  if (outcome === "correct") {
    const stage = Math.min(base.stage + 1, 5) as ReviewStage;
    return clean({
      ...base,
      needsPractice: undefined,
      stage,
      dueAt: now + REVIEW_INTERVAL_DAYS[stage - 1] * DAY_MS,
      lastResult: "correct",
      learnedAt: base.learnedAt ?? now,
    });
  }
  return clean({
    ...base,
    dueAt: undefined,
    stage: 0,
    needsPractice: true,
    lastResult: "wrong",
    missCount: base.missCount + 1,
    lastMissedAt: now,
  });
}

export function dueReviewKeys(
  words: Record<string, WordPracticeWordState>,
  now: number,
  limit: number,
): string[] {
  return Object.entries(words)
    .filter(
      ([, state]) =>
        state.stage >= 1 && state.dueAt !== undefined && state.dueAt <= now,
    )
    .sort(
      ([keyA, a], [keyB, b]) =>
        a.dueAt! - b.dueAt! || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0),
    )
    .slice(0, Math.max(0, limit))
    .map(([key]) => key);
}

export function migrateWordState(
  legacy: { learnedAt?: number; missCount?: number; lastMissedAt?: number },
  now: number,
): WordPracticeWordState {
  const missCount = legacy.missCount ?? 0;
  if (legacy.learnedAt !== undefined) {
    return clean({
      stage: 1,
      dueAt: now,
      learnedAt: legacy.learnedAt,
      missCount,
      lastMissedAt: legacy.lastMissedAt,
    });
  }
  return clean({
    stage: 0,
    needsPractice: true,
    missCount,
    lastMissedAt: legacy.lastMissedAt,
  });
}
