import { describe, expect, it } from "vitest";
import {
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { STEP_MS } from "../constants";
import { CHARACTERS } from "../data/characters";
import { ARCHETYPE_BY_ELEMENT } from "../data/elements";
import { CHARGE_TIME_MS, ULTIMATE_BASE } from "../data/ultimates";
import type {
  BattleState,
  Command,
  LevelSpec,
  TowerArchetype,
} from "../types";

/**
 * 絕招是這次改版「要好玩」的那一半。
 *
 * 波次進行中玩家本來完全沒有可下的指令，只能看塔自己打。現在每個角色都會充能，
 * 滿了點下去就放屬於它那種打法的大招。
 */

/** 找一個主元素會對應到指定打法的角色。 */
function characterFor(archetype: TowerArchetype) {
  const found = CHARACTERS.find(
    (character) => ARCHETYPE_BY_ELEMENT[character.elements[0]] === archetype,
  );
  if (!found) throw new Error(`沒有任何角色的打法是 ${archetype}`);
  return found;
}

function makeLevel(overrides: Partial<LevelSpec> = {}): CompiledLevel {
  return compileLevel({
    id: "ult-test",
    nameZh: "絕招測試",
    paths: [
      [
        { x: -60, y: 300 },
        { x: 900, y: 300 },
      ],
    ],
    slotPlan: { count: 2 },
    waves: [
      {
        groups: [{ kind: "gumdrop", count: 6, gapMs: 400, delayMs: 0 }],
        bonus: 0,
      },
    ],
    startingFrosting: 5000,
    theme: {
      floor: "#fff",
      floorEdge: "#eee",
      path: "#ddd",
      pathEdge: "#ccc",
      accent: "#f0f",
    },
    coinReward: { clear: 10, threeStars: 5 },
    ...overrides,
  });
}

function run(
  state: BattleState,
  level: CompiledLevel,
  steps: number,
  commands: Command[] = [],
) {
  for (let i = 0; i < steps; i += 1) {
    stepSimulation(state, level, i === 0 ? commands : [], STEP_MS);
  }
  return state;
}

const seconds = (n: number) => Math.ceil((n * 1000) / STEP_MS);

describe("charging", () => {
  it("fills from time alone, so even a cheer tower gets there", () => {
    const cheerleader = characterFor("cheer");
    // 充能只在波次進行中累積，而應援塔傷害是 0，怪會一路走到櫃檯把蛋糕偷光、
    // 提早結束這一場。所以這一關的路要夠長，讓波次撐得比 CHARGE_TIME_MS 久。
    const level = makeLevel({
      paths: [
        [
          { x: -60, y: 300 },
          { x: 1200, y: 300 },
          { x: 1200, y: 500 },
          { x: 60, y: 500 },
          { x: 60, y: 650 },
          { x: 1200, y: 650 },
        ],
      ],
      waves: [
        {
          groups: [{ kind: "gumdrop", count: 40, gapMs: 900, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = createBattle(level, 1);

    run(state, level, 1, [
      {
        kind: "placeTower",
        slotId: level.slots[0].id,
        characterId: cheerleader.id,
      },
      { kind: "startWave" },
    ]);
    run(state, level, seconds(CHARGE_TIME_MS / 1000 + 4));

    // 應援塔傷害是 0，純靠時間也要充得滿，不然它永遠沒有大招。
    expect(state.ultimateCharge[cheerleader.id]).toBe(1);
  });

  it("fills faster when the tower is actually fighting", () => {
    const shooter = characterFor("rapid");

    const chargeAfter = (withEnemies: boolean) => {
      const level = makeLevel(
        withEnemies
          ? {}
          : { waves: [{ groups: [], bonus: 0 }] },
      );
      const state = createBattle(level, 1);
      run(state, level, 1, [
        {
          kind: "placeTower",
          slotId: level.slots[0].id,
          characterId: shooter.id,
        },
        { kind: "startWave" },
      ]);
      run(state, level, seconds(8));
      return state.ultimateCharge[shooter.id] ?? 0;
    };

    expect(chargeAfter(true)).toBeGreaterThan(chargeAfter(false));
  });

  it("stacks the charge of every tower using the same character", () => {
    const shooter = characterFor("rapid");

    const chargeWith = (slotCount: 1 | 2) => {
      const level = makeLevel();
      const state = createBattle(level, 1);
      const placements: Command[] = level.slots
        .slice(0, slotCount)
        .map((slot) => ({
          kind: "placeTower",
          slotId: slot.id,
          characterId: shooter.id,
        }));

      run(state, level, 1, [...placements, { kind: "startWave" }]);
      run(state, level, seconds(6));
      return state.ultimateCharge[shooter.id] ?? 0;
    };

    // 放兩座就充兩倍快——「多帶同一個角色」要看得到回報。
    expect(chargeWith(2)).toBeGreaterThan(chargeWith(1));
  });
});

describe("castUltimate", () => {
  /** 放好一座塔、開打、把充能灌滿，回傳可以直接放招的狀態。 */
  function readyToCast(archetype: TowerArchetype, warmupSeconds = 6) {
    const character = characterFor(archetype);
    const level = makeLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [
      {
        kind: "placeTower",
        slotId: level.slots[0].id,
        characterId: character.id,
      },
      { kind: "startWave" },
    ]);
    run(state, level, seconds(warmupSeconds));
    state.ultimateCharge[character.id] = 1;

    return { state, level, character };
  }

  it("does nothing while the charge is not full", () => {
    const { state, level, character } = readyToCast("cannon");
    state.ultimateCharge[character.id] = 0.9;
    const before = state.enemies.map((enemy) => enemy.hp);

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.enemies.map((enemy) => enemy.hp)).toEqual(before);
    expect(state.ultimateCharge[character.id]).toBeGreaterThan(0.9);
  });

  it("spends the charge when it fires", () => {
    const { state, level, character } = readyToCast("cannon");

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.ultimateCharge[character.id]).toBeLessThan(0.1);
  });

  it("ignores a character that has no tower on the field", () => {
    const { state, level } = readyToCast("cannon");
    const bystander = characterFor("sniper");
    state.ultimateCharge[bystander.id] = 1;

    run(state, level, 1, [
      { kind: "castUltimate", characterId: bystander.id },
    ]);

    // 沒上場就不該把充能花掉——玩家按不到那顆鈕，但指令層也要擋。
    expect(state.ultimateCharge[bystander.id]).toBe(1);
  });

  it("carves into the enemies with 碎裂砲", () => {
    const { state, level, character } = readyToCast("cannon");
    // 比總血量而不是逐一比對：打死的怪會就地從陣列移除，索引會對不上。
    const totalHp = () => state.enemies.reduce((sum, e) => sum + e.hp, 0);
    const before = totalHp();
    const kills = state.kills;

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(totalHp() < before || state.kills > kills).toBe(true);
  });

  it("puts enemies to sleep with 全體睡著", () => {
    const { state, level, character } = readyToCast("lullaby");

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    // 指令在同一步套用，之後 updateEnemies 就會扣掉一格 dt，所以留點餘裕。
    expect(
      state.enemies.some(
        (enemy) => enemy.stunMs >= ULTIMATE_BASE.lullaby.stunMs - STEP_MS * 2,
      ),
    ).toBe(true);
  });

  it("slows a wide area with 糖漿大浪", () => {
    const { state, level, character } = readyToCast("syrup");

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(
      state.enemies.some(
        (enemy) => enemy.slowFactor >= ULTIMATE_BASE.syrup.slowFactor,
      ),
    ).toBe(true);
  });

  it("speeds up the whole board with 大合唱", () => {
    const { state, level, character } = readyToCast("cheer");

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.choirMs).toBeGreaterThan(0);
  });

  it("keeps the run deterministic", () => {
    const play = () => {
      const { state, level, character } = readyToCast("burst");
      run(state, level, 1, [
        { kind: "castUltimate", characterId: character.id },
      ]);
      run(state, level, seconds(4));
      return JSON.stringify({
        kills: state.kills,
        hp: state.enemies.map((enemy) => Math.round(enemy.hp)),
      });
    };

    expect(play()).toBe(play());
  });
});
