import { describe, expect, it } from "vitest";
import {
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { getPlaceCost } from "./economy";
import { getCharacter, DEFAULT_ROSTER_IDS } from "../data/characters";
import { LEVELS } from "../data/levels";
import { FIRST_PREP_MS, MAX_CAKES, STEP_MS } from "../constants";
import { TRAIT_BASE } from "../data/traits";
import type { BattleState, Command, LevelSpec } from "../types";

const SHOP_PATH = compileLevel(LEVELS[0]);

/**
 * 測試關唯一那個塔位的 id。
 *
 * 塔位改由 slotPlanner 沿路生成之後，id 一律是採用順序的 s1、s2…，
 * 不再是關卡資料裡手寫的名字。
 */
const TEST_SLOT = "s1";

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
    slotPlan: { count: 1 },
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
    coinReward: { clear: 60, threeStars: 40 },
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
  it("starts in prep with the level's frosting and a full cake counter", () => {
    const state = createBattle(SHOP_PATH, 1);

    expect(state.phase).toBe("prep");
    expect(state.waveIndex).toBe(0);
    expect(state.frosting).toBe(LEVELS[0].startingFrosting);
    expect(state.cakes).toBe(MAX_CAKES);
    expect(state.prepMs).toBe(FIRST_PREP_MS);
  });

  it("always starts with the same number of cakes", () => {
    // 難度選單拿掉之後，蛋糕數是固定的，不再隨難度變動。
    expect(createBattle(SHOP_PATH, 1).cakes).toBe(MAX_CAKES);
  });
});

describe("placeTower", () => {
  it("charges frosting and occupies the slot", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);
    const pet = getCharacter("shiro")!;

    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "shiro" },
    ]);

    expect(state.towers).toHaveLength(1);
    expect(state.towers[0]).toMatchObject({
      slotId: TEST_SLOT,
      characterId: "shiro",
      level: 1,
    });
    expect(state.frosting).toBe(500 - getPlaceCost(pet));
  });

  it("refuses a second tower on an occupied slot", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "shiro" },
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "kuromi" },
    ]);

    expect(state.towers).toHaveLength(1);
    expect(state.towers[0].characterId).toBe("shiro");
  });

  it("refuses when there is not enough frosting", () => {
    const level = makeTestLevel({ startingFrosting: 10 });
    const state = createBattle(level, 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "shiro" },
    ]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBe(10);
  });

  it("ignores unknown slots and unknown pets", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: "nope", characterId: "shiro" },
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "not-a-pet" },
    ]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBe(500);
  });
});

describe("upgradeTower and sellTower", () => {
  it("levels a tower up to 3 without a specialisation", () => {
    const level = makeTestLevel({ startingFrosting: 5000 });
    const state = createBattle(level, 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "shiro" },
      { kind: "upgradeTower", slotId: TEST_SLOT },
      { kind: "upgradeTower", slotId: TEST_SLOT },
      { kind: "upgradeTower", slotId: TEST_SLOT },
    ]);

    // 3 → 4 是專精分岔，沒指名走哪一條就停在 3 級。細節見 specialisations.test.ts。
    expect(state.towers[0].level).toBe(3);
  });

  it("frees the slot and refunds part of the cost when sold", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "shiro" },
    ]);
    const afterPlacing = state.frosting;

    run(state, level, 1, [{ kind: "sellTower", slotId: TEST_SLOT }]);

    expect(state.towers).toHaveLength(0);
    expect(state.frosting).toBeGreaterThan(afterPlacing);
    expect(state.frosting).toBeLessThan(500);
  });
});

describe("wave flow", () => {
  it("starts the wave automatically when prep time runs out", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, secondsToSteps(FIRST_PREP_MS / 1000) + 2);

    expect(state.phase).toBe("wave");
  });

  it("pays an early-start bonus and skips the rest of prep", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [{ kind: "startWave" }]);

    expect(state.phase).toBe("wave");
    expect(state.frosting).toBeGreaterThan(500);
  });

  it("ignores startWave once the wave is already running", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    const frostingAfterStart = state.frosting;
    run(state, level, 1, [{ kind: "startWave" }]);

    expect(state.frosting).toBe(frostingAfterStart);
  });

  it("clears the level after the final wave is emptied", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    // 沒有塔，一隻軟糖走完 600px 大約 15 秒，之後就沒有敵人了。
    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(20));

    expect(state.phase).toBe("cleared");
  });
});

describe("cakes", () => {
  it("loses a cake when an enemy reaches the counter", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(20));

    expect(state.leaked).toBe(1);
    expect(state.cakes).toBe(MAX_CAKES - 1);
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
    const state = createBattle(level, 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, secondsToSteps(60));

    expect(state.phase).toBe("lost");
    expect(state.cakes).toBe(0);
  });
});

describe("towers in combat", () => {
  it("kills enemies and collects their reward", () => {
    const level = makeTestLevel();
    const state = createBattle(level, 1);

    run(state, level, 1, [
      // ember 爆裂，剋 leaf 的軟糖小兵
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "minna-no-tabo" },
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
        {
          groups: [{ kind: "soda", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = createBattle(level, 1);

    run(state, level, 1, [
      // spark 速射，剋 tide 的汽水泡泡
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "pochacco" },
      { kind: "startWave" },
    ]);
    // 打破泡泡的當下就會冒出兩隻小泡。
    run(state, level, secondsToSteps(9));

    expect(state.kills).toBeGreaterThanOrEqual(1);
    expect(state.enemies.every((enemy) => enemy.kind === "soda-mini")).toBe(
      true,
    );
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
      slotPlan: { count: 0 },
    });
    const state = createBattle(level, 1);

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
      { kind: "placeTower", slotId: "s1", characterId: "shiro" },
      { kind: "placeTower", slotId: "s4", characterId: "minna-no-tabo" },
      { kind: "placeTower", slotId: "s7", characterId: "kuromi" },
      { kind: "startWave" },
    ];

    const runOnce = () => {
      const level = compileLevel(LEVELS[0]);
      const state = createBattle(level, 12345);
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
    const state = createBattle(level, 7);
    const before = state.rngState;

    run(state, level, 1, [
      { kind: "placeTower", slotId: "s1", characterId: "kuromi" }, // dream -> 催眠，會擲骰
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
/**
 * 無渲染快跑：用固定 seed 把地圖 1 的 15 波從頭跑到尾，同時模擬兩種玩家。
 *
 * 這裡鎖的是難度的「形狀」，不是某個數字：一個懂遊戲的組合在普通難度應該零
 * 失血通關（拿三星），一個隨便亂放的組合在普通難度也要過得去（不然小孩會被
 * 卡住），但在挑戰難度就該輸。之後調任何數值只要破壞其中一條，這裡就會叫。
 */
describe("full 10-wave run on 店門小徑", () => {
  /** 懂遊戲的人會蓋的組合：主力輸出 + 一座應援 + 一座控場。 */
  const GOOD_BUILD = [
    "minna-no-tabo",
    "shiro",
    "pochacco",
    "minna-no-tabo",
    "usahana",
    "shiro",
    "minna-no-tabo",
    "kuromi",
  ];

  /** 小孩隨便放：每個塔位換一隻沒玩過的。 */
  const NAIVE_BUILD = DEFAULT_ROSTER_IDS;

  type PlaythroughResult = {
    state: BattleState;
    /** 所有塔都升到滿級時，正在打第幾波（1-based）；沒滿就是 null */
    maxedAtWave: number | null;
  };

  /**
   * 模擬一個會做基本功的玩家：有錢就補塔位，塔位滿了就輪流升級，
   * 每一波都提早出發。
   */
  function playThrough(
    build: string[],
  ): PlaythroughResult {
    const level = compileLevel(LEVELS[0]);
    const state = createBattle(level, 99);
    const slotIds = level.slots.map((slot) => slot.id);
    let placed = 0;
    let upgradeCursor = 0;
    let maxedAtWave: number | null = null;

    for (let step = 0; step < secondsToSteps(1200); step += 1) {
      const commands: Command[] = [];

      if (placed < slotIds.length) {
        const characterId = build[placed % build.length];
        const pet = getCharacter(characterId)!;
        if (state.frosting >= getPlaceCost(pet)) {
          commands.push({
            kind: "placeTower",
            slotId: slotIds[placed],
            characterId,
          });
          placed += 1;
        }
      } else if (state.towers.length > 0) {
        const tower = state.towers[upgradeCursor % state.towers.length];
        upgradeCursor += 1;
        if (tower.level < 4) {
          // 3 → 4 要指名專精。兩條路輪流選，模擬「玩家會選，但不特別會選」。
          commands.push({
            kind: "upgradeTower",
            slotId: tower.slotId,
            spec: upgradeCursor % 2 === 0 ? "a" : "b",
          });
        }
      }

      if (state.phase === "prep") {
        commands.push({ kind: "startWave" });
      }

      stepSimulation(state, level, commands, STEP_MS);

      if (
        maxedAtWave === null &&
        state.towers.length === slotIds.length &&
        state.towers.every((tower) => tower.level === 3)
      ) {
        maxedAtWave = state.waveIndex + 1;
      }

      if (state.phase === "cleared" || state.phase === "lost") break;
    }

    return { state, maxedAtWave };
  }

  it("rewards a sensible build on normal with every cake intact", () => {
    const { state } = playThrough(GOOD_BUILD);

    expect(state.phase).toBe("cleared");
    expect(state.waveIndex).toBe(LEVELS[0].waves.length - 1);
    expect(state.leaked).toBe(0);
    expect(state.kills).toBeGreaterThan(100);
  });

  it("still lets a scattershot build clear", () => {
    // 防挫折：只有一種難度，而且刻意偏簡單——第一關不該因為「亂選角色」就過不了。
    const { state } = playThrough(NAIVE_BUILD);

    expect(state.phase).toBe("cleared");
  });

  it("still rewards picking a sensible squad", () => {
    // 難度選單拿掉之後，「挑戰難度會輸」這個保證也一起沒了，但取捨不能跟著
    // 消失：亂選也過得了關，可是要付出代價，好好搭配才守得住全部蛋糕。
    // 比的是兩種組合的相對結果，不綁任何絕對數字，重新平衡時不會假性壞掉。
    const good = playThrough(GOOD_BUILD).state;
    const naive = playThrough(NAIVE_BUILD).state;

    expect(good.cakes).toBeGreaterThanOrEqual(naive.cakes);
    expect(good.kills).toBeGreaterThan(0);
  });

  it("finishes every wave rather than stalling", () => {
    const { state } = playThrough(GOOD_BUILD);

    expect(state.enemies).toHaveLength(0);
    expect(state.spawnQueue).toHaveLength(0);
  });

  it("keeps upgrades worth buying deep into the level", () => {
    const { maxedAtWave } = playThrough(GOOD_BUILD);

    // 全部點滿發生得太早，代表中後段沒東西可花，錢就失去意義了。
    // 10 波的經濟下正常是整場都點不滿（null）；就算點滿也不能早於第 7 波。
    if (maxedAtWave !== null) {
      expect(maxedAtWave).toBeGreaterThanOrEqual(7);
    }
  });

  it("leaves some frosting unspent rather than starving the player", () => {
    const { state } = playThrough(GOOD_BUILD);

    expect(state.frosting).toBeGreaterThan(0);
  });
});

/**
 * 副元素特性是「48 隻角色手感不重複」的來源，所以每一種都要確認它真的有作用，
 * 不是只寫在說明文字裡。
 */
describe("secondary-element traits in battle", () => {
  /** 一條直線路徑 + 一個塔位，讓效果單獨顯現。 */
  function traitLevel(enemyCount: number, gapMs: number): CompiledLevel {
    return makeTestLevel({
      waves: [
        {
          groups: [{ kind: "gumdrop", count: enemyCount, gapMs, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
  }

  /** 跑到塔至少開過一次火，回傳當下的狀態。 */
  function runUntilFirstHit(
    characterId: string,
    level: CompiledLevel,
  ): BattleState {
    const state = createBattle(level, 1);
    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId },
      { kind: "startWave" },
    ]);

    for (let step = 0; step < secondsToSteps(20); step += 1) {
      stepSimulation(state, level, [], STEP_MS);
      if (state.enemies.some((enemy) => enemy.hp < enemy.maxHp)) break;
    }
    return state;
  }

  it("毒液: leaves damage over time ticking after the shot lands", () => {
    // pochacco = spark + leaf → 速射 · 毒液
    const level = traitLevel(1, 0);
    const state = runUntilFirstHit("pochacco", level);

    const poisoned = state.enemies[0];
    expect(poisoned.dotDps).toBeGreaterThan(0);
    expect(poisoned.dotMs).toBeGreaterThan(0);

    // 塔沒再開火的那幾幀，血依然在掉。
    const before = poisoned.hp;
    for (let i = 0; i < 10; i += 1) {
      stepSimulation(state, level, [], STEP_MS);
    }
    expect(state.enemies[0]?.hp ?? 0).toBeLessThan(before);
  });

  it("冰霜: slows the target even though the tower is not a syrup tower", () => {
    // goropikadon = spark + tide → 速射 · 冰霜
    const level = traitLevel(1, 0);
    const state = runUntilFirstHit("goropikadon", level);

    const chilled = state.enemies[0];
    expect(chilled.slowMs).toBeGreaterThan(0);
    expect(chilled.slowFactor).toBeGreaterThan(0);
  });

  it("碎甲: strips armour a little at a time, up to a cap", () => {
    // we-are-dinosaurs = ember + crystal → 爆裂 · 碎甲
    const level = makeTestLevel({
      waves: [
        {
          groups: [{ kind: "chocolate", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = runUntilFirstHit("we-are-dinosaurs", level);

    expect(state.enemies[0].armorShred).toBeGreaterThan(0);

    for (let step = 0; step < secondsToSteps(20); step += 1) {
      stepSimulation(state, level, [], STEP_MS);
      if (state.enemies.length === 0) break;
    }

    for (const enemy of state.enemies) {
      expect(enemy.armorShred).toBeLessThanOrEqual(TRAIT_BASE.shred.max);
    }
  });

  it("連鎖: jumps the shot to a nearby enemy", () => {
    // minna-no-tabo = ember + spark → 爆裂 · 連鎖
    const level = traitLevel(4, 250);
    const state = createBattle(level, 1);
    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "minna-no-tabo" },
      { kind: "startWave" },
    ]);

    let jumped = false;
    for (let step = 0; step < secondsToSteps(25); step += 1) {
      stepSimulation(state, level, [], STEP_MS);
      // 起點 + 第一個目標 = 2 個點；有第三個點就代表電流跳過去了。
      if (state.beams.some((beam) => beam.points.length > 2)) {
        jumped = true;
        break;
      }
    }

    expect(jumped).toBe(true);
  });

  it("連鎖: never hits the same enemy twice in one chain", () => {
    const level = traitLevel(4, 250);
    const state = createBattle(level, 1);
    run(state, level, 1, [
      { kind: "placeTower", slotId: TEST_SLOT, characterId: "minna-no-tabo" },
      { kind: "startWave" },
    ]);

    for (let step = 0; step < secondsToSteps(25); step += 1) {
      stepSimulation(state, level, [], STEP_MS);

      for (const beam of state.beams) {
        // 跳過起點（塔的位置），其餘每個點都該是不同的敵人座標。
        const targets = beam.points.slice(1).map((p) => `${p.x},${p.y}`);
        expect(new Set(targets).size).toBe(targets.length);
      }
    }
  });

  it("連擊: speeds the tower up while it keeps hitting the same target", () => {
    // my-sweet-piano = dream + star → 催眠 · 連擊。挑打得動但打不死的，
    // 才看得到連段累積——一發秒殺的塔連段永遠是 1。
    const level = makeTestLevel({
      waves: [
        {
          groups: [{ kind: "chocolate", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = runUntilFirstHit("my-sweet-piano", level);

    // 記錄連段的最高點——目標一被打死連段就歸零，所以不能等跑完再看。
    let peakCombo = 0;
    for (let step = 0; step < secondsToSteps(10); step += 1) {
      stepSimulation(state, level, [], STEP_MS);
      peakCombo = Math.max(peakCombo, state.towers[0].comboHits);
      if (state.phase !== "wave") break;
    }

    expect(peakCombo).toBeGreaterThan(3);
  });

  it("連擊: does not carry a streak over into the next wave", () => {
    const level = makeTestLevel({
      waves: [
        {
          groups: [{ kind: "gumdrop", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
        {
          groups: [{ kind: "gumdrop", count: 1, gapMs: 0, delayMs: 0 }],
          bonus: 0,
        },
      ],
    });
    const state = runUntilFirstHit("my-sweet-piano", level);

    expect(state.towers[0].comboHits).toBeGreaterThan(0);

    // 跑到這一波清空、進入下一波的準備階段。
    for (let step = 0; step < secondsToSteps(30); step += 1) {
      stepSimulation(state, level, [], STEP_MS);
      if (state.phase === "prep") break;
    }

    expect(state.phase).toBe("prep");
    expect(state.towers[0].comboHits).toBe(0);
  });

  it("純粹: single-element characters trade the trait for raw damage", () => {
    // gudetama 只有 dream 一種元素，是全表唯一的單元素角色，拿不到特性，改吃傷害加成。
    const level = traitLevel(1, 0);
    const state = runUntilFirstHit("gudetama", level);

    const hit = state.enemies[0];
    expect(hit.hp).toBeLessThan(hit.maxHp);
    expect(hit.dotDps).toBe(0);
    expect(hit.armorShred).toBe(0);
  });
});
