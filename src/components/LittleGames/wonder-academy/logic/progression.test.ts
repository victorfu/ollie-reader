import { describe, expect, it } from "vitest";
import { MAX_LEVEL, gainXp, xpToNext } from "./progression";

describe("xp curve", () => {
  it("increases the requirement each level", () => {
    expect(xpToNext(1)).toBe(20);
    expect(xpToNext(2)).toBe(30);
    expect(xpToNext(5)).toBe(60);
  });
});

describe("gainXp", () => {
  it("accumulates xp without leveling when below the threshold", () => {
    expect(gainXp(1, 0, 5)).toEqual({ level: 1, xp: 5, levelsGained: 0 });
  });

  it("levels up once and carries the remainder", () => {
    // level 1 needs 20 to reach 2; 25 -> level 2 with 5 left over
    expect(gainXp(1, 0, 25)).toEqual({ level: 2, xp: 5, levelsGained: 1 });
  });

  it("rolls over multiple levels in one gain", () => {
    // 60: -20 -> L2 (40 left), -30 -> L3 (10 left), need 40 for L4 -> stop
    expect(gainXp(1, 0, 60)).toEqual({ level: 3, xp: 10, levelsGained: 2 });
  });

  it("respects existing partial xp", () => {
    // level 2 with 25/30, gain 10 -> 35 -> level 3 with 5 left
    expect(gainXp(2, 25, 10)).toEqual({ level: 3, xp: 5, levelsGained: 1 });
  });

  it("caps at MAX_LEVEL with no stored overflow", () => {
    expect(gainXp(MAX_LEVEL, 0, 9999)).toEqual({
      level: MAX_LEVEL,
      xp: 0,
      levelsGained: 0,
    });
    const capped = gainXp(MAX_LEVEL - 1, 0, 999999);
    expect(capped.level).toBe(MAX_LEVEL);
    expect(capped.xp).toBe(0);
  });
});
