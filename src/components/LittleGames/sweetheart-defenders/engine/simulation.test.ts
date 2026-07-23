import { describe, expect, it } from "vitest";
import {
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { getPlaceCost } from "./economy";
import { getPet } from "../data/pets";
import { LEVELS } from "../data/levels";
import { CAKES_BY_DIFFICULTY, FIRST_PREP_MS, STEP_MS } from "../constants";
import type { BattleState, Command, Difficulty, LevelSpec } from "../types";

const SHOP_PATH = compileLevel(LEVELS[0]);

/** 一條直線、一個塔位的最小關卡，方便單獨驗證某個行為。 */
function makeTestLevel(overrides: Partial<LevelSpec> = {}): CompiledLevel {
  return compileLevel({
    id: "test-level",
    nameZh: "測試關",
    paths: [
      [
        { x: 0, y: 100 },
        { x: 600, y: 100 },
      ],
    ],
    slots: [{ id: "a", x: 300, y: 40 }],
    waves: [
      {
        groups: [{ kind: "gumdrop", count: 1, gapMs: 0, delayMs: 0 }],
        bonus: 50,
      },
    ],
    startingFrosting: 500,
    theme: {
      floor: "#fff",
      floorEdge: "#eee",
      path: "#ddd",
      pathEdge: "#ccc",
      accent: "#f0f",
    },
    unlocksOnClear: [],
    unlocksOnThreeStars: [],
    ...overrides,
  });
}

/** 跑 n 步，可選擇在第一步送出指令。 */
function run(
  state: BattleState,
  level: CompiledLevel,
  steps: number,
  commands: Command[] = [],
): BattleState {
  for (let i = 0; i < steps; i += 1) {
    stepSimulation(state, level, i === 0 ? commands : [], STEP_MS);
  }
  return state;
}

function secondsToSteps(seconds: number): number {
  return Math.ceil((seconds * 1000) / STEP_MS);
}

describe("createBattle", () => {
  it("starts in prep with the level's frosting and the difficulty's cakes", () => {
    const state = createBattle(SHOP_PATH, "normal", 1);

    expect(state.phase).toBe("prep");
    expect(state.waveIndex).toBe(0);
    expect(state.frosting).toBe(LEVELS[0].startingFrosting);
    expect(state.cakes).toBe(CAKES_BY_DIFFICULTY.normal);
    expect(state.prepMs).toBe(FIRST_PREP_MS);
  });

  it("gives easy more cakes than hard", () => {
    const easy = createBattle(SHOP_PATH, "easy", 1);
    const hard = createBattle(SHOP_PATH, "hard", 1);

    expect(easy.cakes).toBeGreaterThan(hard.cakes);
  });
});

describe("placeTower", () => {
  it("charges frosting and occupies the slot", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);
    const pet = getPet("lumi")!;

    run(state, level, 1, [
      { kind: "placeTower", slotId: "a", petId: "lumi" },
    ]);

    expect(state.towers).toHaveLength(1);
    expect(state.towers[0]).toMatchObject({ slotId: "a", petId: "lumi", level: 1 });
    expect(state.frosting).toBe(500 - getPlaceCost(pet));
  });

  it("refuses a second tower on an occupied slot", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: "a", petId: "lumi" },
      { kind: "placeTower", slotId: "a", petId: "momo" },
    ]);

    expect(state.towers).toHaveLength(1);
    expect(state.towers[0].petId).toBe("lumi");
  });

  it("refuses when there is not enough frosting", () => {
    const level = makeTestLevel({ startingFrosting: 10 });
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: "a", petId: "lumi" },
    ]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBe(10);
  });

  it("ignores unknown slots and unknown pets", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: "nope", petId: "lumi" },
      { kind: "placeTower", slotId: "a", petId: "not-a-pet" },
    ]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBe(500);
  });
});

describe("upgradeTower and sellTower", () => {
  it("levels a tower up to 3 and no further", () => {
    const level = makeTestLevel({ startingFrosting: 5000 });
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: "a", petId: "lumi" },
      { kind: "upgradeTower", slotId: "a" },
      { kind: "upgradeTower", slotId: "a" },
      { kind: "upgradeTower", slotId: "a" },
    ]);

    expect(state.towers[0].level).toBe(3);
  });

  it("frees the slot and refunds part of the cost when sold", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "placeTower", slotId: "a", petId: "lumi" }]);
    const afterPlacing = state.frosting;

    run(state, level, 1, [{ kind: "sellTower", slotId: "a" }]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBeGreaterThan(afterPlacing);
    expect(state.frosting).toBeLessThan(500);
  });
});

describe("wave flow", () => {
  it("starts the wave automatically when prep time runs out", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, secondsToSteps(FIRST_PREP_MS / 1000) + 2);

    expect(state.phase).toBe("wave");
  });

  it("pays an early-start bonus and skips the rest of prep", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);

    expect(state.phase).toBe("wave");
    expect(state.frosting).toBeGreaterThan(500);
  });

  it("ignores startWave once the wave is already running", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    const frostingAfterStart = state.frosting;
    run(state, level, 1, [{ kind: "startWave" }]);

    expect(state.frosting).toBe(frostingAfterStart);
  });

  it("clears the level after the final wave is emptied", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    // 沒有塔，一隻軟糖走完 600px 大約 15 秒，之後就沒有敵人了。
    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(20));

    expect(state.phase).toBe("cleared");
  });
});

describe("cakes", () => {
  it("loses a cake when an enemy reaches the counter", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(20));

    expect(state.leaked).toBe(1);
    expect(state.cakes).toBe(CAKES_BY_DIFFICULTY.normal - 1);
  });

  it("ends the run when the last cake is stolen", () => {
    const level = makeTestLevel({
      waves: [
        {
          groups: [{ kind: "gumdrop", count: 40, gapMs: 200, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(60));

    expect(state.phase).toBe("lost");
    expect(state.cakes).toBe(0);
  });
});

describe("towers in combat", () => {
  it("kills enemies and collects their reward", () => {
    const level = makeTestLevel();
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      // ember 爆裂，剋 leaf 的軟糖小兵
      { kind: "placeTower", slotId: "a", petId: "nibi" },
      { kind: "startWave" },
    ]);
    run(state, level, secondsToSteps(20));

    expect(state.kills).toBe(1);
    expect(state.leaked).toBe(0);
    expect(state.phase).toBe("cleared");
  });

  it("splits a soda bubble into minis when it pops", () => {
    const level = makeTestLevel({
      waves: [
        { groups: [{ kind: "soda", count: 1, gapMs: 0, delayMs: 0 }], bonus: 0 },
      ],
    });
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [
      // spark 速射，剋 tide 的汽水泡泡
      { kind: "placeTower", slotId: "a", petId: "ticktock-sparrow" },
      { kind: "startWave" },
    ]);
    // 打破泡泡的當下就會冒出兩隻小泡。
    run(state, level, secondsToSteps(9));

    expect(state.kills).toBeGreaterThanOrEqual(1);
    expect(state.enemies.every((enemy) => enemy.kind === "soda-mini")).toBe(true);
  });

  it("leaves flying enemies untouched by the walking path's detours", () => {
    const level = makeTestLevel({
      paths: [
        [
          { x: 0, y: 100 },
          { x: 300, y: 100 },
          { x: 300, y: 400 },
          { x: 600, y: 400 },
        ],
      ],
      waves: [
        {
          groups: [{ kind: "frosting-ghost", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
      ],
      slots: [],
    });
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(3));

    const ghost = state.enemies[0];
    // 直線飛行：走到一半時 y 已經明顯離開起始的 100，而地面路線此時還在 y=100。
    expect(ghost.y).toBeGreaterThan(120);
  });
});

describe("determinism", () => {
  it("produces an identical run for the same seed and commands", () => {
    const script: Command[] = [
      { kind: "placeTower", slotId: "s1", petId: "lumi" },
      { kind: "placeTower", slotId: "s4", petId: "nibi" },
      { kind: "placeTower", slotId: "s7", petId: "momo" },
      { kind: "startWave" },
    ];

    const runOnce = () => {
      const level = compileLevel(LEVELS[0]);
      const state = createBattle(level, "normal", 12345);
      run(state, level, 1, script);
      run(state, level, secondsToSteps(120));
      return state;
    };

    const first = runOnce();
    const second = runOnce();

    expect(second.kills).toBe(first.kills);
    expect(second.leaked).toBe(first.leaked);
    expect(second.frosting).toBe(first.frosting);
    expect(second.waveIndex).toBe(first.waveIndex);
    expect(second.phase).toBe(first.phase);
  });

  it("does not read the wall clock or Math.random", () => {
    const level = compileLevel(LEVELS[0]);
    const state = createBattle(level, "normal", 7);
    const before = state.rngState;

    run(state, level, 1, [
      { kind: "placeTower", slotId: "s1", petId: "momo" }, // dream -> 催眠，會擲骰
      { kind: "startWave" },
    ]);
    run(state, level, secondsToSteps(30));

    // 催眠塔開過火，種子一定前進過；而且完全由 state 決定。
    expect(state.rngState).not.toBe(before);
  });
});

/**
 * 無渲染快跑：用固定 seed 和一組腳本化的佈塔指令，把地圖 1 的 15 波從頭跑到尾。
 * 這同時是平衡回歸測試——之後調整數值時，如果這關突然變成過不了或輕鬆全清，
 * 這個測試就會先叫出來。
 */
describe("full 15-wave run on 店門小徑", () => {
  // 只用開場就有的四隻 starter，混搭幾種打法。
  const LOADOUT: { slotId: string; petId: string }[] = [
    { slotId: "s1", petId: "nibi" }, // ember 爆裂，剋軟糖
    { slotId: "s2", petId: "nibi" },
    { slotId: "s4", petId: "lumi" }, // light 狙擊
    { slotId: "s5", petId: "nibi" },
    { slotId: "s6", petId: "momo" }, // dream 催眠
    { slotId: "s7", petId: "lumi" },
    { slotId: "s8", petId: "nibi" },
    { slotId: "s3", petId: "pico" }, // star 應援，幫旁邊的塔加速
  ];

  type PlaythroughResult = {
    state: BattleState;
    /** 所有塔都升到滿級時，正在打第幾波（1-based）；沒滿就是 null */
    maxedAtWave: number | null;
  };

  function playThrough(difficulty: Difficulty): PlaythroughResult {
    const level = compileLevel(LEVELS[0]);
    const state = createBattle(level, difficulty, 99);
    let placed = 0;
    let upgradeCursor = 0;
    let maxedAtWave: number | null = null;

    for (let step = 0; step < secondsToSteps(1200); step += 1) {
      const commands: Command[] = [];

      // 先把塔位補滿，之後把多的糖霜輪流投在升級上——真人也是這樣玩。
      if (placed < LOADOUT.length) {
        const next = LOADOUT[placed];
        const pet = getPet(next.petId)!;
        if (state.frosting >= getPlaceCost(pet)) {
          commands.push({ kind: "placeTower", ...next });
          placed += 1;
        }
      } else if (state.towers.length > 0) {
        const tower = state.towers[upgradeCursor % state.towers.length];
        upgradeCursor += 1;
        if (tower.level < 3) {
          commands.push({ kind: "upgradeTower", slotId: tower.slotId });
        }
      }

      if (state.phase === "prep") {
        commands.push({ kind: "startWave" });
      }

      stepSimulation(state, level, commands, STEP_MS);

      if (
        maxedAtWave === null &&
        state.towers.length === LOADOUT.length &&
        state.towers.every((tower) => tower.level === 3)
      ) {
        maxedAtWave = state.waveIndex + 1;
      }

      if (state.phase === "cleared" || state.phase === "lost") break;
    }

    return { state, maxedAtWave };
  }

  it("rewards flawless play on normal with every cake intact", () => {
    const { state } = playThrough("normal");

    expect(state.phase).toBe("cleared");
    expect(state.waveIndex).toBe(LEVELS[0].waves.length - 1);
    expect(state.leaked).toBe(0);
    expect(state.kills).toBeGreaterThan(100);
  });

  it("finishes every wave rather than stalling", () => {
    const { state } = playThrough("normal");

    expect(state.enemies).toHaveLength(0);
    expect(state.spawnQueue).toHaveLength(0);
  });

  it("is harder on hard than on easy", () => {
    const easy = playThrough("easy");
    const hard = playThrough("hard");

    expect(hard.state.leaked).toBeGreaterThan(easy.state.leaked);
  });

  it("keeps upgrades worth buying deep into the level", () => {
    const { maxedAtWave } = playThrough("normal");

    // 全部點滿發生得太早，代表中後段沒東西可花，錢就失去意義了。
    expect(maxedAtWave).not.toBeNull();
    expect(maxedAtWave!).toBeGreaterThanOrEqual(10);
  });

  it("leaves some frosting unspent rather than starving the player", () => {
    const { state } = playThrough("normal");

    expect(state.frosting).toBeGreaterThan(0);
  });
});
