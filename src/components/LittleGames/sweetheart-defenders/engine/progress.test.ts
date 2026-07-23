import { describe, expect, it } from "vitest";
import {
  applyRunResult,
  starsForRun,
  summariseRun,
  type CampaignProgress,
} from "./progress";
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
  const EMPTY: CampaignProgress = {
    levelStars: {},
    bestWave: {},
    claimedClear: [],
    claimedThreeStars: [],
  };
  const REWARD = { clear: 60, threeStars: 40 };

  it("records the stars and pays the clear reward", () => {
    const { progress, coinsEarned } = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 8, maxCakes: 10 }),
      REWARD,
    );

    expect(progress.levelStars["shop-path"]).toBe(2);
    expect(coinsEarned).toBe(REWARD.clear);
  });

  it("pays both rewards at once for a first-try three star", () => {
    const { coinsEarned } = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );

    expect(coinsEarned).toBe(REWARD.clear + REWARD.threeStars);
  });

  /**
   * 這條是重點：不擋重複領的話，一直重打第一關會比往後打划算，
   * 整個「打塔防 → 賺代幣」的循環就爛掉了。
   */
  it("never pays for the same level twice", () => {
    const first = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );
    const replay = applyRunResult(
      first.progress,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );

    expect(replay.coinsEarned).toBe(0);
  });

  it("still pays the three-star bonus when a replay finally earns it", () => {
    const oneStar = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 2, maxCakes: 10 }),
      REWARD,
    );
    expect(oneStar.coinsEarned).toBe(REWARD.clear);

    const perfect = applyRunResult(
      oneStar.progress,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );

    // 通關獎已經領過，這次只補三星那一份。
    expect(perfect.coinsEarned).toBe(REWARD.threeStars);
    expect(perfect.progress.levelStars["shop-path"]).toBe(3);
  });

  it("pays nothing and records no stars when the run was lost", () => {
    const { progress, coinsEarned } = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 7 }),
      REWARD,
    );

    expect(coinsEarned).toBe(0);
    expect(progress.levelStars["shop-path"]).toBeUndefined();
  });

  it("still records how far a losing run got", () => {
    const { progress } = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 7 }),
      REWARD,
    );

    expect(progress.bestWave["shop-path"]).toBe(8);
  });

  it("keeps the furthest wave rather than the latest one", () => {
    const far = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 11 }),
      REWARD,
    );
    const nearer = applyRunResult(
      far.progress,
      "shop-path",
      makeState({ phase: "lost", cakes: 0, waveIndex: 2 }),
      REWARD,
    );

    expect(nearer.progress.bestWave["shop-path"]).toBe(12);
  });

  it("never downgrades a level that was already played better", () => {
    const threeStars = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );
    const sloppyReplay = applyRunResult(
      threeStars.progress,
      "shop-path",
      makeState({ cakes: 2, maxCakes: 10 }),
      REWARD,
    );

    expect(sloppyReplay.progress.levelStars["shop-path"]).toBe(3);
  });

  it("returns the same object when nothing improved", () => {
    const once = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10, waveIndex: 14 }),
      REWARD,
    );
    const again = applyRunResult(
      once.progress,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10, waveIndex: 14 }),
      REWARD,
    );

    expect(again.progress).toBe(once.progress);
  });

  it("keeps progress from other levels intact", () => {
    const first = applyRunResult(
      EMPTY,
      "shop-path",
      makeState({ cakes: 10, maxCakes: 10 }),
      REWARD,
    );
    const second = applyRunResult(
      first.progress,
      "kitchen-cross",
      makeState({ cakes: 7, maxCakes: 10 }),
      REWARD,
    );

    expect(second.progress.levelStars["shop-path"]).toBe(3);
    expect(second.progress.levelStars["kitchen-cross"]).toBe(2);
    expect(second.coinsEarned).toBe(REWARD.clear);
  });
});
