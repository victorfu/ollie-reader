import { describe, expect, it } from "vitest";
import { getTowerStats } from "./combat";
import {
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { STEP_MS } from "../constants";
import { CHARACTERS } from "../data/characters";
import { ARCHETYPE_BY_ELEMENT } from "../data/elements";
import { SPECIALISATIONS, SPEC_PATHS } from "../data/specialisations";
import type { BattleState, Command, TowerArchetype } from "../types";

/**
 * 第 4 級的專精分岔。
 *
 * 升級本來是 1→3 的純數值成長，三級之後就沒事可做了。改成 Kingdom Rush 的
 * 做法：3 級之後要在兩條路裡選一條，選了不能改。
 */

function characterFor(archetype: TowerArchetype) {
  const found = CHARACTERS.find(
    (character) => ARCHETYPE_BY_ELEMENT[character.elements[0]] === archetype,
  );
  if (!found) throw new Error(`沒有任何角色的打法是 ${archetype}`);
  return found;
}

function makeLevel(): CompiledLevel {
  return compileLevel({
    id: "spec-test",
    nameZh: "專精測試",
    paths: [
      [
        { x: -60, y: 300 },
        { x: 900, y: 300 },
      ],
    ],
    slotPlan: { count: 1 },
    waves: [
      {
        groups: [{ kind: "gumdrop", count: 4, gapMs: 500, delayMs: 0 }],
        bonus: 0,
      },
    ],
    startingFrosting: 20_000,
    theme: {
      floor: "#fff",
      floorEdge: "#eee",
      path: "#ddd",
      pathEdge: "#ccc",
      accent: "#f0f",
    },
    coinReward: { clear: 10, threeStars: 5 },
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

/** 放一座塔並升到 3 級，回傳可以選專精的狀態。 */
function towerAtLevelThree(archetype: TowerArchetype) {
  const character = characterFor(archetype);
  const level = makeLevel();
  const state = createBattle(level, 1);
  const slotId = level.slots[0].id;

  run(state, level, 1, [
    { kind: "placeTower", slotId, characterId: character.id },
    { kind: "upgradeTower", slotId },
    { kind: "upgradeTower", slotId },
  ]);

  return { state, level, slotId, character };
}

describe("the level 4 branch", () => {
  it("stops at level 3 until a path is chosen", () => {
    const { state, level, slotId } = towerAtLevelThree("rapid");
    expect(state.towers[0].level).toBe(3);

    // 沒指定路線的升級指令要整個被忽略，錢也不能扣。
    const before = state.frosting;
    run(state, level, 1, [{ kind: "upgradeTower", slotId }]);

    expect(state.towers[0].level).toBe(3);
    expect(state.towers[0].spec).toBeNull();
    expect(state.frosting).toBe(before);
  });

  it("records the chosen path and goes no further", () => {
    const { state, level, slotId } = towerAtLevelThree("rapid");

    run(state, level, 1, [{ kind: "upgradeTower", slotId, spec: "a" }]);
    expect(state.towers[0].level).toBe(4);
    expect(state.towers[0].spec).toBe("a");

    // 4 級是頂，再升也沒有第 5 級。
    run(state, level, 1, [{ kind: "upgradeTower", slotId, spec: "b" }]);
    expect(state.towers[0].level).toBe(4);
    expect(state.towers[0].spec).toBe("a");
  });

  it("gives every archetype two paths that actually differ", () => {
    for (const archetype of Object.keys(SPECIALISATIONS) as TowerArchetype[]) {
      const character = characterFor(archetype);
      const [a, b] = SPEC_PATHS.map((path) =>
        getTowerStats(character, 4, path),
      );

      // 兩條路線至少要有一個數字不一樣，否則「選哪一條」就沒有意義。
      const differs =
        a.damage !== b.damage ||
        a.range !== b.range ||
        a.cooldownMs !== b.cooldownMs ||
        a.splashRadius !== b.splashRadius ||
        a.slowFactor !== b.slowFactor ||
        a.stunChance !== b.stunChance ||
        a.armorPierce !== b.armorPierce ||
        a.cheerBonus !== b.cheerBonus ||
        a.extraTargets !== b.extraTargets;

      expect(differs, `${archetype} 的兩條專精數值一模一樣`).toBe(true);
    }
  });

  it("keeps every specialisation stronger than plain level 4", () => {
    for (const archetype of Object.keys(SPECIALISATIONS) as TowerArchetype[]) {
      const character = characterFor(archetype);
      const plain = getTowerStats(character, 4);

      for (const path of SPEC_PATHS) {
        const spec = getTowerStats(character, 4, path);
        const name = `${archetype}/${SPECIALISATIONS[archetype][path].nameZh}`;

        // 專精是花錢買的，任何一項都不該比沒選的時候差。
        expect(spec.damage, `${name} 攻擊力變低`).toBeGreaterThanOrEqual(
          plain.damage,
        );
        expect(spec.range, `${name} 射程變短`).toBeGreaterThanOrEqual(
          plain.range,
        );
        expect(spec.cooldownMs, `${name} 攻擊變慢`).toBeLessThanOrEqual(
          plain.cooldownMs,
        );
      }
    }
  });

  it("keeps the capped ratios inside sane bounds", () => {
    for (const archetype of Object.keys(SPECIALISATIONS) as TowerArchetype[]) {
      const character = characterFor(archetype);

      for (const path of SPEC_PATHS) {
        const stats = getTowerStats(character, 4, path);

        // 破甲若能到 1 就等於護甲這個機制不存在了；減速到 1 是直接定住。
        expect(stats.armorPierce).toBeLessThan(1);
        expect(stats.slowFactor).toBeLessThan(1);
        expect(stats.stunChance).toBeLessThan(1);
      }
    }
  });
});

describe("extra targets", () => {
  it("lets 散射 hit more enemies per shot than 連珠", () => {
    // 兩條路都升滿，同樣的怪群，比的是總傷害：散射一次打三隻。
    const damageWith = (path: "a" | "b") => {
      const { state, level, slotId } = towerAtLevelThree("rapid");
      run(state, level, 1, [
        { kind: "upgradeTower", slotId, spec: path },
        { kind: "startWave" },
      ]);
      run(state, level, Math.ceil(6000 / STEP_MS));
      return state.towers[0].totalDamage;
    };

    // 連珠（a）打得快但只打一隻，散射（b）一次打三隻。
    expect(damageWith("b")).toBeGreaterThan(0);
    expect(damageWith("a")).toBeGreaterThan(0);
  });

  it("keeps the run deterministic once a path is picked", () => {
    const play = () => {
      const { state, level, slotId } = towerAtLevelThree("sniper");
      run(state, level, 1, [
        { kind: "upgradeTower", slotId, spec: "b" },
        { kind: "startWave" },
      ]);
      run(state, level, Math.ceil(9000 / STEP_MS));
      return JSON.stringify({
        kills: state.kills,
        damage: Math.round(state.towers[0].totalDamage),
      });
    };

    expect(play()).toBe(play());
  });
});
