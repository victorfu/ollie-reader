import { describe, expect, it } from "vitest";
import { isLevelUnlocked, nextPlayableLevelId } from "./unlocks";
import { LEVELS } from "./levels";

/**
 * 關卡是一條線：一次只開放下一關，不是一整片任你挑。
 * 規則寫在這裡而不是畫面裡，才測得到。
 */
describe("level gating", () => {
  const [first, second, third] = LEVELS;

  it("always leaves the first level open", () => {
    expect(isLevelUnlocked(first.id, {})).toBe(true);
  });

  it("keeps every later level shut until the one before it is cleared", () => {
    expect(isLevelUnlocked(second.id, {})).toBe(false);
    expect(isLevelUnlocked(third.id, {})).toBe(false);
  });

  it("opens exactly one more level per clear", () => {
    const afterFirst = { [first.id]: 1 as const };

    expect(isLevelUnlocked(second.id, afterFirst)).toBe(true);
    expect(isLevelUnlocked(third.id, afterFirst)).toBe(false);
  });

  it("treats a failed run as not cleared", () => {
    expect(isLevelUnlocked(second.id, { [first.id]: 0 })).toBe(false);
  });

  it("does not need three stars to move on", () => {
    expect(isLevelUnlocked(second.id, { [first.id]: 1 })).toBe(true);
  });

  it("refuses to unlock a level that does not exist", () => {
    expect(isLevelUnlocked("not-a-level", {})).toBe(false);
  });
});

describe("nextPlayableLevelId", () => {
  it("points at the first level on a fresh save", () => {
    expect(nextPlayableLevelId({})).toBe(LEVELS[0].id);
  });

  it("moves on as levels get cleared", () => {
    expect(nextPlayableLevelId({ [LEVELS[0].id]: 2 })).toBe(LEVELS[1].id);
  });

  it("skips ahead past levels already beaten", () => {
    const stars = Object.fromEntries(
      LEVELS.slice(0, 3).map((level) => [level.id, 3 as const]),
    );

    expect(nextPlayableLevelId(stars)).toBe(LEVELS[3].id);
  });

  it("stays on the last level once everything is beaten", () => {
    const stars = Object.fromEntries(
      LEVELS.map((level) => [level.id, 3 as const]),
    );

    expect(nextPlayableLevelId(stars)).toBe(LEVELS[LEVELS.length - 1].id);
  });
});

describe("coin rewards", () => {
  it("gives every level something for clearing and for three stars", () => {
    for (const level of LEVELS) {
      expect(level.coinReward.clear).toBeGreaterThan(0);
      expect(level.coinReward.threeStars).toBeGreaterThan(0);
    }
  });

  it("pays more for later levels", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].coinReward.clear).toBeGreaterThan(
        LEVELS[i - 1].coinReward.clear,
      );
    }
  });

  it("makes one clear worth at least a gacha pull", () => {
    // 抽一次扭蛋 50 代幣。打完一關卻連一次都抽不起的話，
    // 「打塔防 → 賺代幣 → 抽扭蛋 → 新角色」這個循環就接不起來。
    const GACHA_DRAW_COST = 50;

    for (const level of LEVELS) {
      expect(level.coinReward.clear).toBeGreaterThanOrEqual(GACHA_DRAW_COST);
    }
  });
});
