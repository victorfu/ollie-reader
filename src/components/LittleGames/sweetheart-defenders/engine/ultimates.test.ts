import { describe, expect, it } from "vitest";
import {
  SUGAR_POOL_RANGE_BONUS,
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { getTowerStats } from "./combat";
import { STEP_MS } from "../constants";
import { CHARACTERS } from "../data/characters";
import { ARCHETYPE_BY_ELEMENT } from "../data/elements";
import {
  CHARGE_TIME_MS,
  TEAM_CHARGE_PER_CAST,
  TEAM_ULTIMATE_BASE,
  ULTIMATE_BASE,
} from "../data/ultimates";
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

  it("extends range-based ultimate targeting for a tower in a sugar pool", () => {
    const character = characterFor("cannon");
    const dry = makeLevel();
    const slot = dry.slots[0];
    const pooled = makeLevel({
      zones: [{ kind: "sugarPool", x: slot.x, y: slot.y, radius: 60 }],
    });
    const baseRange = getTowerStats(character, 1).range;

    const damageFromUltimate = (level: CompiledLevel) => {
      const state = createBattle(level, 1);
      stepSimulation(
        state,
        level,
        [
          {
            kind: "placeTower",
            slotId: level.slots[0].id,
            characterId: character.id,
          },
          { kind: "startWave" },
        ],
        STEP_MS,
      );

      const enemy = state.enemies[0];
      expect(enemy).toBeDefined();
      // 放在原射程外、20% 糖霜池加成後的射程內。
      enemy.x = level.slots[0].x + baseRange * (1 + SUGAR_POOL_RANGE_BONUS / 2);
      enemy.y = level.slots[0].y;
      enemy.hp = 10_000;
      enemy.maxHp = 10_000;
      state.towers[0].cooldownMs = 10_000;
      state.ultimateCharge[character.id] = 1;

      const before = enemy.hp;
      stepSimulation(
        state,
        level,
        [{ kind: "castUltimate", characterId: character.id }],
        0,
      );
      return before - enemy.hp;
    };

    expect(damageFromUltimate(dry)).toBe(0);
    expect(damageFromUltimate(pooled)).toBeGreaterThan(0);
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

  it("charges the team gauge one notch per cast", () => {
    const { state, level, character } = readyToCast("rapid");
    expect(state.teamCharge).toBe(0);

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.teamCharge).toBeCloseTo(TEAM_CHARGE_PER_CAST, 5);
  });

  it("does not charge the team gauge when the cast was ignored", () => {
    const { state, level, character } = readyToCast("rapid");
    state.ultimateCharge[character.id] = 0.5;

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.teamCharge).toBe(0);
  });

  it("caps the team gauge at full", () => {
    const { state, level, character } = readyToCast("rapid");
    state.teamCharge = 0.9;

    run(state, level, 1, [{ kind: "castUltimate", characterId: character.id }]);

    expect(state.teamCharge).toBe(1);
  });
});

describe("castTeamUltimate", () => {
  /**
   * 用應援角色佈陣：它傷害是 0，怪的血量只會被隊伍大絕招動到，
   * 每隻怪掉多少血就能精準比對。
   */
  function teamReady(memberCount: 1 | 2 = 1) {
    const members = CHARACTERS.filter(
      (character) => ARCHETYPE_BY_ELEMENT[character.elements[0]] === "cheer",
    ).slice(0, memberCount);
    if (members.length < memberCount) {
      throw new Error("應援打法的角色不夠這個測試用");
    }

    const level = makeLevel();
    const state = createBattle(level, 1);
    const placements: Command[] = members.map((character, index) => ({
      kind: "placeTower",
      slotId: level.slots[index].id,
      characterId: character.id,
    }));

    run(state, level, 1, [...placements, { kind: "startWave" }]);
    run(state, level, seconds(6));
    state.teamCharge = 1;

    return { state, level, members };
  }

  it("does nothing while the gauge is not full", () => {
    const { state, level } = teamReady();
    state.teamCharge = 0.9;
    const before = state.enemies.map((enemy) => enemy.hp);

    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    expect(state.enemies.map((enemy) => enemy.hp)).toEqual(before);
    expect(state.teamCharge).toBe(0.9);
  });

  it("hits every enemy on the map, range be damned", () => {
    const { state, level } = teamReady();
    const before = new Map(state.enemies.map((enemy) => [enemy.uid, enemy.hp]));
    expect(before.size).toBeGreaterThan(0);

    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    expect(state.teamCharge).toBe(0);
    for (const enemy of state.enemies) {
      const hpBefore = before.get(enemy.uid);
      if (hpBefore === undefined) continue;
      expect(enemy.hp).toBeCloseTo(
        hpBefore - TEAM_ULTIMATE_BASE.damagePerMember,
        5,
      );
    }
  });

  it("staggers the whole map for a moment", () => {
    const { state, level } = teamReady();

    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    expect(state.enemies.length).toBeGreaterThan(0);
    expect(
      state.enemies.every(
        (enemy) => enemy.stunMs >= TEAM_ULTIMATE_BASE.stunMs - STEP_MS * 2,
      ),
    ).toBe(true);
  });

  it("hits harder for every distinct member on the field", () => {
    const { state, level } = teamReady(2);
    const before = new Map(state.enemies.map((enemy) => [enemy.uid, enemy.hp]));
    expect(before.size).toBeGreaterThan(0);

    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    const damage = TEAM_ULTIMATE_BASE.damagePerMember * 2;
    for (const [uid, hpBefore] of before) {
      const enemy = state.enemies.find((candidate) => candidate.uid === uid);
      if (enemy) {
        expect(enemy.hp).toBeCloseTo(hpBefore - damage, 5);
      } else {
        // 不在場上就是被打死了——那牠的血量必須本來就撐不過這一擊。
        expect(hpBefore).toBeLessThanOrEqual(damage);
      }
    }
  });

  it("keeps the charge when there is nothing to hit", () => {
    const cheerleader = characterFor("cheer");
    const level = makeLevel();
    const state = createBattle(level, 1);
    run(state, level, 1, [
      {
        kind: "placeTower",
        slotId: level.slots[0].id,
        characterId: cheerleader.id,
      },
    ]);
    state.teamCharge = 1;

    // 還在準備階段、場上沒有怪；亂按不該把集滿的量表放水流。
    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    expect(state.teamCharge).toBe(1);
  });

  it("keeps the charge when no tower is on the field", () => {
    const level = makeLevel();
    const state = createBattle(level, 1);
    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, seconds(3));
    state.teamCharge = 1;
    expect(state.enemies.length).toBeGreaterThan(0);

    run(state, level, 1, [{ kind: "castTeamUltimate" }]);

    expect(state.teamCharge).toBe(1);
  });
});
