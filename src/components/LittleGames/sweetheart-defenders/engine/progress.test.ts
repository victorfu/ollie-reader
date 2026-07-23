import { describe, expect, it } from "vitest";
import { applyRunResult, starsForRun, summariseRun } from "./progress";
import type { BattleState } from "../types";

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    levelId: "test",
    difficulty: "normal",
    timeMs: 0,
    phase: "cleared",
    waveIndex: 14,
    prepMs: 0,
    frosting: 0,
    cakes: 10,
    maxCakes: 10,
    enemies: [],
    towers: [],
    projectiles: [],
    beams: [],
    effects: [],
    spawnQueue: [],
    kills: 200,
    leaked: 0,
    speed: 1,
    rngState: 1,
    nextUid: 1,
    ...overrides,
  };
}

describe("starsForRun", () => {
  it("awards three stars for an untouched counter", () => {
    expect(starsForRun(makeState({ cakes: 10, maxCakes: 10 }))).toBe(3);
  });

  it("awards two stars for losing a few cakes", () => {
    expect(starsForRun(makeState({ cakes: 8, maxCakes: 10 }))).toBe(2);
  });

  it("awards one star for scraping through", () => {
    expect(starsForRun(makeState({ cakes: 2, maxCakes: 10 }))).toBe(1);
  });

  it("awards nothing when the level was not cleared", () => {
    expect(starsForRun(makeState({ phase: "lost", cakes: 0 }))).toBe(0);
    expect(starsForRun(makeState({ phase: "wave", cakes: 9 }))).toBe(0);
  });
});

describe("summariseRun", () => {
  it("celebrates a clear with the remaining cakes", () => {
    const summary = summariseRun(makeState({ cakes: 7, kills: 180 }), 15);

    expect(summary.title).toContain("守住");
    expect(summary.detail).toContain("7");
  });

  it("never says game over on a loss", () => {
    const summary = summariseRun(
      makeState({ phase: "lost", waveIndex: 11, cakes: 0 }),
      15,
    );

    expect(summary.title).toContain("第 12 波");
    expect(`${summary.title}${summary.detail}`.toLowerCase()).not.toContain(
      "game over",
    );
  });

  it("points out how close a near-miss was", () => {
    const summary = summariseRun(
      makeState({ phase: "lost", waveIndex: 12, cakes: 0 }),
      15,
    );

    expect(summary.detail).toContain("只差 2 波");
  });
});

describe("applyRunResult", () => {
  const EMPTY = { levelStars: {}, unlockedPetIds: ["starter"], bestWave: {} };
  // 假的解鎖表：拿越多星送越多隻。
  const unlocks = (levelId: string, stars: number) =>
    stars >= 3 ? [`${levelId}-a`, `${levelId}-b`] : [`${levelId}-a`];

  it("records the stars and hands over the unlocks", () => {
    const next = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      unlocks,
    );

    expect(next.levelStars["shop-path"]).toBe(3);
    expect(next.unlockedPetIds).toContain("shop-path-a");
    expect(next.unlockedPetIds).toContain("shop-path-b");
  });

  it("keeps the starters that were already unlocked", () => {
    const next = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 8, maxCakes: 10 }),
      unlocks,
    );

    expect(next.unlockedPetIds).toContain("starter");
  });

  it("hands out no stars or pets when the run was lost", () => {
    const next = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 7 }),
      unlocks,
    );

    expect(next.levelStars["shop-path"]).toBeUndefined();
    expect(next.unlockedPetIds).toEqual(["starter"]);
  });

  it("still records how far a losing run got", () => {
    const next = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 7 }),
      unlocks,
    );

    expect(next.bestWave["shop-path"]).toBe(8);
  });

  it("keeps the furthest wave rather than the latest one", () => {
    const far = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 11 }),
      unlocks,
    );
    const nearer = applyRunResult(
      far,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 2 }),
      unlocks,
    );

    expect(nearer.bestWave["shop-path"]).toBe(12);
  });

  it("returns the same object when nothing improved", () => {
    const once = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10, waveIndex: 14 }),
      unlocks,
    );
    const again = applyRunResult(
      once,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10, waveIndex: 14 }),
      unlocks,
    );

    expect(again).toBe(once);
  });

  it("never downgrades a level that was already played better", () => {
    const threeStars = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      unlocks,
    );
    const afterSloppyReplay = applyRunResult(
      threeStars,
      "shop-path",
      makeState({ cakes: 2, maxCakes: 10 }),
      unlocks,
    );

    expect(afterSloppyReplay.levelStars["shop-path"]).toBe(3);
    expect(afterSloppyReplay.unlockedPetIds).toContain("shop-path-b");
  });

  it("upgrades the record when a replay does better", () => {
    const oneStar = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 2, maxCakes: 10 }),
      unlocks,
    );
    expect(oneStar.unlockedPetIds).not.toContain("shop-path-b");

    const perfect = applyRunResult(
      oneStar,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      unlocks,
    );

    expect(perfect.levelStars["shop-path"]).toBe(3);
    expect(perfect.unlockedPetIds).toContain("shop-path-b");
  });

  it("keeps progress from other levels intact", () => {
    const first = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      unlocks,
    );
    const second = applyRunResult(
      first,
      "kitchen-cross",
      makeState({ cakes: 7, maxCakes: 10 }),
      unlocks,
    );

    expect(second.levelStars["shop-path"]).toBe(3);
    expect(second.levelStars["kitchen-cross"]).toBe(2);
  });
});
