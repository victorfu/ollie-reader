import { describe, expect, it } from "vitest";
import { LEVELS, getLevel } from "./levels";
import { getEnemy } from "./enemies";
import { getPet, STARTER_PET_IDS } from "./pets";
import { HEIGHT, SLOT_RADIUS, STEP_MS, WIDTH } from "../constants";
import { distanceToPath } from "../engine/path";
import { getPlaceCost } from "../engine/economy";
import { compileLevel, createBattle, stepSimulation } from "../engine/simulation";
import { previewWave } from "../engine/waves";
import type { Command, Difficulty, LevelSpec } from "../types";

/** 路面半寬 + 塔位半徑：小於這個距離，塔看起來就是蓋在路中間。 */
const MIN_SLOT_CLEARANCE = 23 + SLOT_RADIUS;

describe("level geometry", () => {
  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s keeps every tower slot off the path",
    (_name, level) => {
      for (const slot of level.slots) {
        for (const path of level.paths) {
          expect(
            distanceToPath(slot, path),
            `塔位 ${slot.id} 壓在路面上`,
          ).toBeGreaterThan(MIN_SLOT_CLEARANCE);
        }
      }
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s keeps every tower slot on screen",
    (_name, level) => {
      for (const slot of level.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(WIDTH);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(HEIGHT);
      }
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s uses unique slot ids",
    (_name, level) => {
      const ids = level.slots.map((slot) => slot.id);
      expect(ids).toHaveLength(new Set(ids).size);
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s starts every path off screen and ends them all at the same counter",
    (_name, level) => {
      const ends = new Set<string>();

      for (const path of level.paths) {
        // 怪要從畫面外走進來，不然會憑空出現在地圖裡。
        expect(path[0].x < 0 || path[0].y < 0 || path[0].x > WIDTH).toBe(true);

        const end = path[path.length - 1];
        ends.add(`${end.x},${end.y}`);
      }

      // 只有一個櫃檯，所以所有路線都得走到同一點。
      expect(ends.size).toBe(1);
    },
  );

  it("gives later levels more slots to work with", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(LEVELS[i].slots.length).toBeGreaterThan(LEVELS[i - 1].slots.length);
    }
  });
});

describe("level wave tables", () => {
  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s runs 15 waves with bosses on 5, 10 and 15",
    (_name, level) => {
      expect(level.waves).toHaveLength(15);

      for (const [index, wave] of level.waves.entries()) {
        const hasBoss = previewWave(wave).some(
          (entry) => getEnemy(entry.kind).boss,
        );
        expect(hasBoss, `第 ${index + 1} 波的 Boss 狀態不對`).toBe(
          (index + 1) % 5 === 0,
        );
      }
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s only sends enemies down paths that exist",
    (_name, level) => {
      for (const wave of level.waves) {
        for (const group of wave.groups) {
          expect(group.pathIndex ?? 0).toBeLessThan(level.paths.length);
        }
      }
    },
  );

  it("lets the player afford at least two towers per path at the start", () => {
    const cheapest = Math.min(
      ...STARTER_PET_IDS.map((id) => getPlaceCost(getPet(id)!)),
    );

    for (const level of LEVELS) {
      expect(
        level.startingFrosting,
        `${level.nameZh} 開場的錢不夠鋪滿入口`,
      ).toBeGreaterThanOrEqual(cheapest * 2 * level.paths.length);
    }
  });
});

describe("getLevel", () => {
  it("finds a level by id and returns undefined otherwise", () => {
    expect(getLevel(LEVELS[0].id)).toBe(LEVELS[0]);
    expect(getLevel("nope")).toBeUndefined();
  });
});

/**
 * 每張地圖都用無渲染快跑實際打一遍。
 *
 * 這裡鎖的是難度的「形狀」：隨便亂放在輕鬆難度一定要過得去（不然小孩會卡在
 * 第一張圖），而一個像樣的組合在普通難度要能通關。純看數字很難確定波表產生器
 * 調出來的關卡真的能玩，所以直接跑。
 */
describe("every level is actually beatable", () => {
  const GOOD_BUILD = [
    "nibi",
    "lumi",
    "ticktock-sparrow",
    "nibi",
    "pico",
    "lumi",
    "nibi",
    "momo",
  ];

  function playThrough(
    level: LevelSpec,
    difficulty: Difficulty,
    build: string[],
  ) {
    const compiled = compileLevel(level);
    const state = createBattle(compiled, difficulty, 99);
    const slotIds = level.slots.map((slot) => slot.id);
    let placed = 0;
    let upgradeCursor = 0;

    // 20 分鐘的模擬時間，足夠跑完任何一張圖。
    for (let step = 0; step < (20 * 60 * 1000) / STEP_MS; step += 1) {
      const commands: Command[] = [];

      if (placed < slotIds.length) {
        const petId = build[placed % build.length];
        if (state.frosting >= getPlaceCost(getPet(petId)!)) {
          commands.push({ kind: "placeTower", slotId: slotIds[placed], petId });
          placed += 1;
        }
      } else if (state.towers.length > 0) {
        const tower = state.towers[upgradeCursor % state.towers.length];
        upgradeCursor += 1;
        if (tower.level < 3) {
          commands.push({ kind: "upgradeTower", slotId: tower.slotId });
        }
      }

      if (state.phase === "prep") commands.push({ kind: "startWave" });

      stepSimulation(state, compiled, commands, STEP_MS);
      if (state.phase === "cleared" || state.phase === "lost") break;
    }

    return state;
  }

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s can be cleared on normal with a sensible build",
    (_name, level) => {
      const state = playThrough(level, "normal", GOOD_BUILD);

      expect(state.phase).toBe("cleared");
      expect(state.waveIndex).toBe(level.waves.length - 1);
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s can be cleared on easy even when the pets are picked at random",
    (_name, level) => {
      const state = playThrough(level, "easy", STARTER_PET_IDS);

      expect(state.phase).toBe("cleared");
    },
  );

  it("never reports a clear on the same frame the last cake is stolen", () => {
    // 最後一隻怪同時「離場」與「打穿櫃檯」時，結果必須算輸。
    for (const level of LEVELS) {
      for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
        const state = playThrough(level, difficulty, STARTER_PET_IDS);
        if (state.phase === "cleared") {
          expect(
            state.cakes,
            `${level.nameZh}/${difficulty} 在蛋糕歸零時被判定通關`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
