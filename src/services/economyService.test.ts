import { describe, it, expect } from "vitest";
import {
  COIN_REWARDS,
  coinMultiplierForDefLanguage,
  coinsForAnswer,
  coinsForStageClear,
  computeDailyBonus,
  computeHomeworkReward,
  nextHomeworkStreak,
  todayLocal,
} from "./economyService";

describe("coinsForAnswer", () => {
  it("gives base coins at zero combo", () => {
    expect(coinsForAnswer(0)).toBe(COIN_REWARDS.correct);
  });
  it("adds combo bonus up to the cap", () => {
    expect(coinsForAnswer(3)).toBe(
      COIN_REWARDS.correct + 3 * COIN_REWARDS.comboStep,
    );
    expect(coinsForAnswer(999)).toBe(
      COIN_REWARDS.correct + COIN_REWARDS.comboCap * COIN_REWARDS.comboStep,
    );
  });
});

describe("coinsForStageClear", () => {
  it("uses the explicit reward when provided", () => {
    expect(coinsForStageClear(30, false)).toBe(30);
    expect(coinsForStageClear(0, true)).toBe(0);
  });
  it("falls back to a formula with a boss bonus", () => {
    expect(coinsForStageClear(undefined, false)).toBe(COIN_REWARDS.stageClear);
    expect(coinsForStageClear(undefined, true)).toBe(
      COIN_REWARDS.stageClear + COIN_REWARDS.bossClearBonus,
    );
  });
});

describe("coinMultiplierForDefLanguage", () => {
  it("leaves Chinese mode at the base rate", () => {
    expect(coinMultiplierForDefLanguage("zh")).toBe(1);
  });
  it("boosts English mode", () => {
    expect(coinMultiplierForDefLanguage("en")).toBe(
      COIN_REWARDS.englishModeMultiplier,
    );
  });
});

describe("英文模式代幣倍率", () => {
  const enMultiplier = COIN_REWARDS.englishModeMultiplier;

  it("scales answer coins", () => {
    expect(coinsForAnswer(0, enMultiplier)).toBe(
      COIN_REWARDS.correct * enMultiplier,
    );
    expect(coinsForAnswer(3, enMultiplier)).toBe(
      (COIN_REWARDS.correct + 3 * COIN_REWARDS.comboStep) * enMultiplier,
    );
  });

  it("scales the formula-derived stage clear reward", () => {
    expect(coinsForStageClear(undefined, true, enMultiplier)).toBe(
      (COIN_REWARDS.stageClear + COIN_REWARDS.bossClearBonus) * enMultiplier,
    );
  });

  // 迴歸測試：coinsForStageClear 以前在 rewardCoins 有值時直接 return，
  // 倍率會整章吃不到（第二章每一關都設了 rewardCoins）
  it("scales an explicit stage reward instead of short-circuiting past it", () => {
    expect(coinsForStageClear(120, true, enMultiplier)).toBe(
      120 * enMultiplier,
    );
    expect(coinsForStageClear(30, false, enMultiplier)).toBe(30 * enMultiplier);
  });

  // saveProgressWithTokenReward 對非安全整數會丟 RangeError，且該錯誤會被
  // handleQuizEnd 的 catch 吞掉 → 整輪代幣默默消失，所以取整是關鍵防線
  it("always yields a safe integer", () => {
    for (let combo = 0; combo <= 12; combo++) {
      expect(Number.isSafeInteger(coinsForAnswer(combo, enMultiplier))).toBe(
        true,
      );
    }
    for (const reward of [undefined, 0, 30, 35, 120]) {
      expect(
        Number.isSafeInteger(coinsForStageClear(reward, true, enMultiplier)),
      ).toBe(true);
    }
  });

  it("keeps a zero reward at zero", () => {
    expect(coinsForStageClear(0, true, enMultiplier)).toBe(0);
  });
});

describe("computeDailyBonus", () => {
  it("grants the base bonus on the first ever claim", () => {
    const r = computeDailyBonus("", "2026-07-13", 0);
    expect(r).toEqual({
      eligible: true,
      coins: COIN_REWARDS.dailyBase,
      streakDays: 1,
    });
  });

  it("continues the streak when claimed on consecutive days", () => {
    const r = computeDailyBonus("2026-07-12", "2026-07-13", 3);
    expect(r.eligible).toBe(true);
    expect(r.streakDays).toBe(4);
    expect(r.coins).toBe(COIN_REWARDS.dailyBase + 3 * COIN_REWARDS.dailyStreakStep);
  });

  it("resets the streak after a missed day", () => {
    const r = computeDailyBonus("2026-07-10", "2026-07-13", 5);
    expect(r.eligible).toBe(true);
    expect(r.streakDays).toBe(1);
    expect(r.coins).toBe(COIN_REWARDS.dailyBase);
  });

  it("is not eligible when already claimed today", () => {
    const r = computeDailyBonus("2026-07-13", "2026-07-13", 4);
    expect(r).toEqual({ eligible: false, coins: 0, streakDays: 4 });
  });

  it("caps the daily coins", () => {
    const r = computeDailyBonus("2026-06-30", "2026-07-01", 999);
    expect(r.coins).toBe(COIN_REWARDS.dailyCap);
  });

  it("handles month rollover for the consecutive-day check", () => {
    const r = computeDailyBonus("2026-06-30", "2026-07-01", 2);
    expect(r.streakDays).toBe(3);
  });
});

describe("todayLocal", () => {
  it("formats a date as YYYY-MM-DD with zero padding", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayLocal(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("homework rewards", () => {
  it("counts the hand-in, each correct dictation word, and the first homework of the day", () => {
    expect(computeHomeworkReward({ correctCount: 6, total: 7, firstToday: true, streakDays: 1 })).toEqual({
      coins: 48,
      items: [
        { kind: "handIn", coins: 20 },
        { kind: "dictation", coins: 18, count: 6 },
        { kind: "firstToday", coins: 10 },
      ],
    });
  });

  it("adds the perfect-dictation bonus and the streak bonus, capped at 20", () => {
    expect(computeHomeworkReward({ correctCount: 3, total: 3, firstToday: true, streakDays: 3 })).toEqual({
      coins: 20 + 9 + 10 + 10 + 10,
      items: [
        { kind: "handIn", coins: 20 },
        { kind: "dictation", coins: 9, count: 3 },
        { kind: "perfect", coins: 10 },
        { kind: "firstToday", coins: 10 },
        { kind: "streak", coins: 10, count: 3 },
      ],
    });
    const long = computeHomeworkReward({ correctCount: 0, total: 2, firstToday: true, streakDays: 30 });
    expect(long.items.find((item) => item.kind === "streak")?.coins).toBe(20);
  });

  it("gives a later homework the same day only the hand-in and dictation parts", () => {
    expect(computeHomeworkReward({ correctCount: 2, total: 4, firstToday: false, streakDays: 5 })).toEqual({
      coins: 26,
      items: [
        { kind: "handIn", coins: 20 },
        { kind: "dictation", coins: 6, count: 2 },
      ],
    });
  });

  it("gives no perfect bonus when every dictation item was skipped", () => {
    const reward = computeHomeworkReward({ correctCount: 0, total: 0, firstToday: false, streakDays: 1 });
    expect(reward).toEqual({ coins: 20, items: [{ kind: "handIn", coins: 20 }] });
  });

  it("stays below a cleared adventure stage of five correct answers", () => {
    const adventureStage = [0, 1, 2, 3, 4].reduce((sum, combo) => sum + coinsForAnswer(combo), 0)
      + coinsForStageClear(undefined, false);
    const typical = computeHomeworkReward({ correctCount: 6, total: 7, firstToday: true, streakDays: 1 });
    expect(typical.coins).toBeLessThan(adventureStage);
  });

  it("tracks the homework streak by local day", () => {
    expect(nextHomeworkStreak(undefined, "2026-10-25")).toEqual({ firstToday: true, days: 1 });
    expect(nextHomeworkStreak({ lastDay: "2026-10-24", days: 4 }, "2026-10-25")).toEqual({ firstToday: true, days: 5 });
    expect(nextHomeworkStreak({ lastDay: "2026-10-25", days: 5 }, "2026-10-25")).toEqual({ firstToday: false, days: 5 });
    expect(nextHomeworkStreak({ lastDay: "2026-10-20", days: 9 }, "2026-10-25")).toEqual({ firstToday: true, days: 1 });
  });
});
