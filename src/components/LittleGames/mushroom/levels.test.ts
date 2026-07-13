import { afterEach, describe, expect, it, vi } from "vitest";
import { MUSHROOM_CONFIG } from "../lib/constants";
import { HEIGHT } from "./constants";
import { BASE_LEVELS, buildLevels, LEVEL_COUNT, TUTORIAL_LEVEL } from "./levels";
import type { Level, Platform } from "./types";
import { type MushroomSettings } from "../lib/types";

// 以固定種子取代 Math.random，讓程序化關卡可重現、測試不飄
const seededRandom = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const withSeed = <T,>(seed: number, fn: () => T): T => {
  const spy = vi.spyOn(Math, "random").mockImplementation(seededRandom(seed));
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
};

const DEFAULTS: MushroomSettings = { ...MUSHROOM_CONFIG.DEFAULT_SETTINGS };

// 玩家可站立的支撐投影（地面段 + 所有平台頂），合併後檢查間隙
const supportGaps = (level: Level): number => {
  const spans = level.platforms
    .map((p: Platform) => [p.x, p.x + p.w] as const)
    .sort((a, b) => a[0] - b[0]);
  let maxGap = 0;
  let coveredTo = spans[0][0];
  for (const [start, end] of spans) {
    if (start > coveredTo) maxGap = Math.max(maxGap, start - coveredTo);
    coveredTo = Math.max(coveredTo, end);
    if (coveredTo >= level.flag.x) break;
  }
  return maxGap;
};

const groundPieces = (level: Level) =>
  level.platforms.filter((p) => p.y + p.h >= HEIGHT - 0.5);

describe("mushroom BASE_LEVELS（手工關卡）", () => {
  it(`有 ${LEVEL_COUNT} 關且每關有主題與旗子`, () => {
    expect(BASE_LEVELS).toHaveLength(LEVEL_COUNT);
    for (const lvl of BASE_LEVELS) {
      expect(lvl.theme.name).toBeTruthy();
      expect(lvl.flag.x).toBeGreaterThan(900);
    }
  });

  it("出生點（x 40–200）下方一定有地面", () => {
    for (const lvl of [...BASE_LEVELS, TUTORIAL_LEVEL]) {
      const spawnFloor = groundPieces(lvl).some(
        (p) => p.x <= 40 && p.x + p.w >= 200,
      );
      expect(spawnFloor, `${lvl.theme.id} 缺出生地面`).toBe(true);
    }
  });

  it("坑洞不會太寬：支撐間隙 ≤ 240px（可單跳跨越）", () => {
    for (const lvl of BASE_LEVELS) {
      expect(supportGaps(lvl), `${lvl.theme.id} 支撐間隙過大`).toBeLessThanOrEqual(240);
    }
  });

  it("每關敵人都站在支撐物上（不會生成在坑上）", () => {
    for (const lvl of BASE_LEVELS) {
      for (const e of lvl.enemies) {
        const cx = e.x + e.w / 2;
        const footY = e.y + e.h;
        const supported = lvl.platforms.some(
          (p) =>
            cx >= p.x &&
            cx <= p.x + p.w &&
            Math.abs(p.y - footY) <= 2,
        );
        expect(supported, `${lvl.theme.id} 敵人 (${e.x},${e.y}) 懸空`).toBe(true);
      }
    }
  });

  it("浮台高度在可視、可達範圍（y ≥ 120）", () => {
    for (const lvl of BASE_LEVELS) {
      for (const p of lvl.platforms) {
        expect(p.y, `${lvl.theme.id} 平台過高`).toBeGreaterThanOrEqual(120);
      }
    }
  });
});

describe("mushroom buildLevels（程序化尾段）", () => {
  const runs = [1, 42, 20260713];

  it("旗子被延伸到尾段末端，且旗子附近有平地降落帶", () => {
    for (const seed of runs) {
      const levels = withSeed(seed, () => buildLevels(DEFAULTS));
      levels.forEach((lvl, i) => {
        expect(lvl.flag.x).toBeGreaterThan(BASE_LEVELS[i].flag.x + 2000);
        const runway = groundPieces(lvl).some(
          (p) => p.x <= lvl.flag.x - 100 && p.x + p.w >= lvl.flag.x + 200,
        );
        expect(runway, `L${i + 1} 旗前缺降落帶 (seed ${seed})`).toBe(true);
      });
    }
  });

  it("整關支撐間隙 ≤ 240px：從出生點到旗子都能通過", () => {
    for (const seed of runs) {
      const levels = withSeed(seed, () => buildLevels(DEFAULTS));
      levels.forEach((lvl, i) => {
        expect(
          supportGaps(lvl),
          `L${i + 1} 出現不可跨越的坑 (seed ${seed})`,
        ).toBeLessThanOrEqual(240);
      });
    }
  });

  it("敵人數量設定 ×2 會生成更多敵人（同種子比較）", () => {
    const count = (settings: MushroomSettings) =>
      withSeed(7, () => buildLevels(settings)).reduce(
        (acc, lvl) => acc + lvl.enemies.length,
        0,
      );
    const base = count(DEFAULTS);
    const doubled = count({ ...DEFAULTS, enemyMultiplier: 2 });
    expect(doubled).toBeGreaterThan(base);
  });

  it("道具頻率設定 ×2 會在尾段生出額外道具", () => {
    const basePowerups = BASE_LEVELS.reduce(
      (acc, lvl) => acc + lvl.powerups.length,
      0,
    );
    const total = withSeed(7, () =>
      buildLevels({ ...DEFAULTS, powerupFrequency: 2 }),
    ).reduce((acc, lvl) => acc + lvl.powerups.length, 0);
    expect(total).toBeGreaterThan(basePowerups);
  });
});

describe("mushroom TUTORIAL_LEVEL（教學關）", () => {
  it("標記為教學關且不進入 buildLevels 的結果", () => {
    expect(TUTORIAL_LEVEL.tutorial).toBe(true);
    const levels = withSeed(1, () => buildLevels(DEFAULTS));
    expect(levels).not.toContain(TUTORIAL_LEVEL);
    for (const lvl of levels) expect(lvl.tutorial).toBeUndefined();
  });

  it("地面完整無坑（教學關不會墜落死亡）", () => {
    const ground = groundPieces(TUTORIAL_LEVEL);
    expect(ground.some((p) => p.x <= 0 && p.x + p.w >= TUTORIAL_LEVEL.flag.x + 100)).toBe(
      true,
    );
  });

  it("踩蘑菇的門有對應的目標敵人在偵測範圍內", () => {
    for (const gate of TUTORIAL_LEVEL.gates ?? []) {
      if (gate.until !== "enemiesCleared") continue;
      const target = TUTORIAL_LEVEL.enemies.some(
        (e) => e.x >= gate.x - 600 && e.x <= gate.x,
      );
      expect(target, `門 ${gate.id} 缺目標敵人`).toBe(true);
    }
    expect(TUTORIAL_LEVEL.gates?.length).toBeGreaterThan(0);
  });

  it("告示依 x 排序且都在旗子前", () => {
    const triggers = TUTORIAL_LEVEL.triggers ?? [];
    expect(triggers.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < triggers.length; i++) {
      expect(triggers[i].x).toBeGreaterThan(triggers[i - 1].x);
    }
    for (const t of triggers) {
      expect(t.x + t.w).toBeLessThanOrEqual(TUTORIAL_LEVEL.flag.x + 100);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
