import { describe, expect, it } from "vitest";
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
