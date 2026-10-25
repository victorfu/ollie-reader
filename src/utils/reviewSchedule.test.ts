import { describe, expect, it } from "vitest";
import {
  applyDictationOutcome,
  dueReviewKeys,
  migrateWordState,
} from "./reviewSchedule";
import type { WordPracticeWordState } from "../types/wordPractice";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

describe("reviewSchedule", () => {
  it("moves a new word to stage 1, due one day later, when written correctly", () => {
    expect(applyDictationOutcome(undefined, "correct", NOW)).toMatchObject({
      stage: 1,
      dueAt: NOW + DAY,
      lastResult: "correct",
      learnedAt: NOW,
      missCount: 0,
    });
  });

  it("steps through 1, 3, 7, 14 and 30 days and stays at stage 5", () => {
    let state = applyDictationOutcome(undefined, "correct", NOW);
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      state = applyDictationOutcome(state, "correct", NOW);
      gaps.push((state.dueAt! - NOW) / DAY);
    }
    expect(gaps).toEqual([3, 7, 14, 30, 30]);
    expect(state.stage).toBe(5);
  });

  it("sends a wrong word back to stage 0 to be practised again", () => {
    const reviewing: WordPracticeWordState = {
      stage: 3,
      dueAt: NOW,
      missCount: 1,
      learnedAt: 1,
    };
    expect(applyDictationOutcome(reviewing, "wrong", NOW)).toEqual({
      stage: 0,
      needsPractice: true,
      lastResult: "wrong",
      learnedAt: 1,
      missCount: 2,
      lastMissedAt: NOW,
    });
  });

  it("clears needsPractice only when the word is written correctly", () => {
    const missed: WordPracticeWordState = {
      stage: 0,
      needsPractice: true,
      missCount: 1,
    };
    expect(applyDictationOutcome(missed, "correct", NOW).needsPractice).toBeUndefined();
  });

  it("leaves a skipped word exactly as it was", () => {
    const reviewing: WordPracticeWordState = {
      stage: 2,
      dueAt: NOW - DAY,
      missCount: 0,
    };
    expect(applyDictationOutcome(reviewing, "skipped", NOW)).toEqual(reviewing);
  });

  it("picks due words, earliest first, up to the limit", () => {
    const words: Record<string, WordPracticeWordState> = {
      later: { stage: 1, dueAt: NOW + 1, missCount: 0 },
      old: { stage: 2, dueAt: NOW - 2 * DAY, missCount: 0 },
      recent: { stage: 1, dueAt: NOW - DAY, missCount: 0 },
      fresh: { stage: 0, missCount: 0 },
    };
    expect(dueReviewKeys(words, NOW, 10)).toEqual(["old", "recent"]);
    expect(dueReviewKeys(words, NOW, 1)).toEqual(["old"]);
    expect(dueReviewKeys(words, NOW, 0)).toEqual([]);
  });

  it("turns a learned legacy word into a stage 1 word due now", () => {
    expect(
      migrateWordState({ learnedAt: 5, missCount: 1, lastMissedAt: 3 }, NOW),
    ).toEqual({ stage: 1, dueAt: NOW, learnedAt: 5, missCount: 1, lastMissedAt: 3 });
  });

  it("turns a missed legacy word into a word to practise first", () => {
    expect(migrateWordState({ missCount: 2, lastMissedAt: 3 }, NOW)).toEqual({
      stage: 0,
      needsPractice: true,
      missCount: 2,
      lastMissedAt: 3,
    });
  });
});
