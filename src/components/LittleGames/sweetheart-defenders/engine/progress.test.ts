import { describe, expect, it } from "vitest";
import { starsForRun, summariseRun } from "./progress";
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
