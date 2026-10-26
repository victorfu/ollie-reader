vi.mock("../../utils/firebaseUtil", () => ({ db: {} }));
import { describe, expect, it, vi } from "vitest";
import { LEVEL_EXP_TABLE } from "../../services/gameProgressService";
import { getAdventureLevelProgress } from "./adventureLevelProgress";

describe("getAdventureLevelProgress", () => {
  it("calculates progress inside a normal level", () => {
    expect(getAdventureLevelProgress(2, 175)).toEqual({
      isMaxLevel: false,
      expInCurrentLevel: 75,
      expNeededForLevel: 150,
      percentage: 50,
    });
  });

  it("returns a finite full bar at the exact maximum-level threshold", () => {
    const totalExp = LEVEL_EXP_TABLE.at(-1)!;
    const result = getAdventureLevelProgress(LEVEL_EXP_TABLE.length, totalExp);

    expect(result).toEqual({
      isMaxLevel: true,
      expInCurrentLevel: 0,
      expNeededForLevel: 0,
      percentage: 100,
    });
    expect(Number.isFinite(result.percentage)).toBe(true);
  });

  it("keeps the maximum-level bar full when experience exceeds the cap", () => {
    const totalExp = LEVEL_EXP_TABLE.at(-1)! + 500;
    expect(
      getAdventureLevelProgress(LEVEL_EXP_TABLE.length, totalExp).percentage,
    ).toBe(100);
  });
});

describe("level cap 40", () => {
  it("extends the table to level 40", () => {
    expect(LEVEL_EXP_TABLE).toHaveLength(40);
    expect(LEVEL_EXP_TABLE.slice(15, 20)).toEqual([11000, 13000, 15200, 17600, 20200]);
    expect(LEVEL_EXP_TABLE.at(-1)).toBe(136000);
  });

  it("level 20 is no longer the top", () => {
    expect(getAdventureLevelProgress(20, 20200).isMaxLevel).toBe(false);
    expect(getAdventureLevelProgress(40, 136000).isMaxLevel).toBe(true);
  });
});
