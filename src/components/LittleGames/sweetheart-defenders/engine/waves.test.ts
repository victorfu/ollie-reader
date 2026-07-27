import { describe, expect, it } from "vitest";
import {
  buildSpawnQueue,
  getEnemyHp,
  getWaveHpScale,
  previewWave,
} from "./waves";
import { ENEMIES } from "../data/enemies";
import type { WaveSpec } from "../types";

const WAVE: WaveSpec = {
  groups: [
    { kind: "gumdrop", count: 3, gapMs: 500, delayMs: 0 },
    { kind: "marshmallow", count: 2, gapMs: 300, delayMs: 2000 },
  ],
  bonus: 40,
};

describe("buildSpawnQueue", () => {
  it("expands every group into one entry per enemy", () => {
    const queue = buildSpawnQueue(WAVE, 0);

    expect(queue).toHaveLength(5);
  });

  it("spaces each group out by its own gap, offset from the wave start", () => {
    const queue = buildSpawnQueue(WAVE, 10_000);

    expect(queue.map((entry) => entry.atMs)).toEqual([
      10_000, 10_500, 11_000, 12_000, 12_300,
    ]);
  });

  it("returns entries in spawn order even when groups interleave", () => {
    const queue = buildSpawnQueue(
      {
        groups: [
          { kind: "chocolate", count: 1, gapMs: 0, delayMs: 5000 },
          { kind: "gumdrop", count: 2, gapMs: 100, delayMs: 0 },
        ],
        bonus: 0,
      },
      0,
    );

    expect(queue.map((entry) => entry.kind)).toEqual([
      "gumdrop",
      "gumdrop",
      "chocolate",
    ]);
  });

  it("defaults enemies to the first path when the group does not pick one", () => {
    const queue = buildSpawnQueue(WAVE, 0);

    expect(queue.every((entry) => entry.pathIndex === 0)).toBe(true);
  });

  it("honours an explicit path assignment", () => {
    const queue = buildSpawnQueue(
      { groups: [{ kind: "gumdrop", count: 2, gapMs: 100, delayMs: 0, pathIndex: 1 }], bonus: 0 },
      0,
    );

    expect(queue.every((entry) => entry.pathIndex === 1)).toBe(true);
  });
});

describe("getWaveHpScale", () => {
  it("leaves the first wave at its base value", () => {
    expect(getWaveHpScale(0)).toBe(1);
  });

  it("grows monotonically across a 15-wave level", () => {
    for (let wave = 1; wave < 15; wave += 1) {
      expect(getWaveHpScale(wave)).toBeGreaterThan(getWaveHpScale(wave - 1));
    }
  });
});

describe("getEnemyHp", () => {
  it("matches the spec value on wave 1 at normal difficulty", () => {
    expect(getEnemyHp("gumdrop", 0)).toBe(ENEMIES.gumdrop.hp);
  });

  it("scales with the level's own hpScale", () => {
    // 難度選單拿掉之後，每張地圖的鬆緊只剩這一個旋鈕：路線越長、塔的輸出
    // 時間越多，就要靠它把難度補回來。
    const plain = getEnemyHp("chocolate", 5);
    const tough = getEnemyHp("chocolate", 5, 1.5);

    expect(tough).toBeGreaterThan(plain);
    expect(tough).toBe(Math.round(plain * 1.5));
  });

  it("returns whole numbers so health bars do not show fractions", () => {
    expect(Number.isInteger(getEnemyHp("soda", 7))).toBe(true);
  });
});

describe("previewWave", () => {
  it("totals each enemy kind across groups", () => {
    const preview = previewWave({
      groups: [
        { kind: "gumdrop", count: 3, gapMs: 100, delayMs: 0 },
        { kind: "gumdrop", count: 2, gapMs: 100, delayMs: 4000 },
        { kind: "chocolate", count: 1, gapMs: 0, delayMs: 8000 },
      ],
      bonus: 0,
    });

    expect(preview).toEqual([
      { kind: "gumdrop", count: 5 },
      { kind: "chocolate", count: 1 },
    ]);
  });
});
