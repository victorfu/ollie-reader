import { describe, expect, it } from "vitest";
import { BOND_LEVEL_THRESHOLDS } from "../constants";
import type { PetBond } from "../types";
import {
  applyMissedVisitBonus,
  awardBond,
  getBondLevel,
  getBondProgress,
  getNewBondUnlocks,
  getUnlockedContent,
  isMissedVisit,
} from "./bond";

describe("awardBond", () => {
  it("partially awards the remaining daily allowance", () => {
    const current: PetBond = {
      total: 138,
      earnedToday: 38,
      earnedDate: "2026-07-30",
    };

    const result = awardBond(current, 6, "2026-07-30");

    expect(result.awarded).toBe(2);
    expect(result.bond).toEqual({
      total: 140,
      earnedToday: 40,
      earnedDate: "2026-07-30",
    });
    expect(result.capReached).toBe(true);
  });

  it("starts a fresh allowance on a new local date", () => {
    const result = awardBond(
      { total: 80, earnedToday: 40, earnedDate: "2026-07-29" },
      10,
      "2026-07-30",
    );

    expect(result.awarded).toBe(10);
    expect(result.bond.earnedToday).toBe(10);
    expect(result.bond.total).toBe(90);
  });
});

describe("bond levels and unlocks", () => {
  it("uses every authored threshold exactly", () => {
    BOND_LEVEL_THRESHOLDS.forEach((threshold, index) => {
      expect(getBondLevel(threshold)).toBe(index + 1);
      if (threshold > 0) expect(getBondLevel(threshold - 1)).toBe(index);
    });
    expect(getBondLevel(99_999)).toBe(20);
  });

  it("reports progress within a level and max-level completion", () => {
    expect(getBondProgress(35)).toMatchObject({
      level: 2,
      currentThreshold: 20,
      nextThreshold: 50,
      earnedInLevel: 15,
      neededForNext: 15,
      ratio: 0.5,
      isMaxLevel: false,
    });
    expect(getBondProgress(2_090)).toMatchObject({
      level: 20,
      nextThreshold: null,
      ratio: 1,
      isMaxLevel: true,
    });
  });

  it("can limit unlock lookups to playable Phase 1 content", () => {
    expect(getUnlockedContent(5, 1).map((unlock) => unlock.id)).toEqual([
      "love-it",
      "spin",
      "you-are-the-best",
    ]);
    expect(getNewBondUnlocks(19, 50, 1).map((unlock) => unlock.id)).toEqual([
      "love-it",
      "spin",
    ]);
  });
});

describe("missed visit bonus", () => {
  const twoDays = 48 * 60 * 60 * 1_000;

  it("triggers at 48 hours but is safe when the clock moves backward", () => {
    expect(isMissedVisit(1_000, 1_000 + twoDays)).toBe(true);
    expect(isMissedVisit(10_000, 1_000)).toBe(false);
  });

  it("advances lastVisitAt together with a capped award", () => {
    const result = applyMissedVisitBonus(
      { total: 39, earnedToday: 39, earnedDate: "2026-07-30" },
      1_000,
      1_000 + twoDays,
      "2026-07-30",
    );

    expect(result.missed).toBe(true);
    expect(result.awarded).toBe(1);
    expect(result.bond.total).toBe(40);
    expect(result.lastVisitAt).toBe(1_000 + twoDays);
  });
});
