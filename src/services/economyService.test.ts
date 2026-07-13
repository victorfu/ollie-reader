import { describe, it, expect } from "vitest";
import {
  COIN_REWARDS,
  GACHA_COST,
  coinsForAnswer,
  coinsForStageClear,
  computeDailyBonus,
  canAffordGacha,
  drawGacha,
  todayLocal,
} from "./economyService";
import { GACHA_POOL } from "../constants/gachaPool";
import { createRng } from "../components/LittleGames/wonder-academy/logic/rng";

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

describe("gacha", () => {
  it("knows when the player can afford a draw", () => {
    expect(canAffordGacha(GACHA_COST)).toBe(true);
    expect(canAffordGacha(GACHA_COST - 1)).toBe(false);
  });

  it("draws a spirit from the pool and charges the cost", () => {
    const result = drawGacha([], createRng(123));
    expect(GACHA_POOL.map((e) => e.id)).toContain(result.spiritId);
    expect(result.coinsSpent).toBe(GACHA_COST);
    expect(result.isDuplicate).toBe(false);
    expect(result.refundCoins).toBe(0);
  });

  it("refunds coins when the drawn spirit is already owned", () => {
    const allIds = GACHA_POOL.map((e) => e.id);
    const result = drawGacha(allIds, createRng(7));
    expect(result.isDuplicate).toBe(true);
    expect(result.refundCoins).toBe(COIN_REWARDS.dupeRefund);
  });

  it("is deterministic for a fixed seed", () => {
    expect(drawGacha([], createRng(42)).spiritId).toBe(
      drawGacha([], createRng(42)).spiritId,
    );
  });
});

describe("todayLocal", () => {
  it("formats a date as YYYY-MM-DD with zero padding", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayLocal(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
