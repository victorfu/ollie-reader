import { describe, expect, it } from "vitest";
import {
  OVEN_VENT_DAMAGE,
  OVEN_VENT_INTERVAL_MS,
  SUGAR_POOL_RANGE_BONUS,
  compileLevel,
  createBattle,
  stepSimulation,
  type CompiledLevel,
} from "./simulation";
import { STEP_MS } from "../constants";
import type { BattleState, Command, LevelSpec, SceneZone } from "../types";

/**
 * 地形區是「每張地圖有自己的玩法」那一半。
 *
 * 以前十二張圖的規則一模一樣，換的只有路線形狀和配色，所以玩起來都是
 * 擺塔 → 按開始 → 看它們打。糖霜池讓塔位有優劣，烤箱口讓地圖自己會做事。
 */

/** 一條直線、塔位貼著路的最小關卡。zones 由每個測試自己給。 */
function makeLevel(zones: SceneZone[], overrides: Partial<LevelSpec> = {}) {
  return compileLevel({
    id: "zone-test",
    nameZh: "地形測試",
    paths: [
      [
        { x: -60, y: 300 },
        { x: 900, y: 300 },
      ],
    ],
    slotPlan: { count: 1 },
    zones,
    waves: [
      {
        groups: [{ kind: "gumdrop", count: 1, gapMs: 0, delayMs: 0 }],
        bonus: 0,
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

describe("sugarPool", () => {
  it("extends the range of a tower standing in it", () => {
    const plain = makeLevel([]);
    const slot = plain.slots[0];
    const pooled = makeLevel([
      { kind: "sugarPool", x: slot.x, y: slot.y, radius: 60 },
    ]);

    expect(plain.rangeBonusBySlot.get(slot.id)).toBeUndefined();
    expect(pooled.rangeBonusBySlot.get(slot.id)).toBe(SUGAR_POOL_RANGE_BONUS);
  });

  it("leaves slots outside the pool alone", () => {
    const level = makeLevel([{ kind: "sugarPool", x: 20, y: 20, radius: 40 }]);

    expect(level.rangeBonusBySlot.size).toBe(0);
  });

  it("lets a pooled tower open fire earlier than a dry one", () => {
    // 同一隻塔、同一條路，只差站不站在池子裡。比的是「第幾步開始扣血」而不是
    // 總傷害：射程夠遠的塔在四秒內開火次數受冷卻限制，總傷害會一樣多，
    // 但射程長的那座更早搆得到走過來的怪。
    const firstHitStep = (zones: SceneZone[]) => {
      const level = makeLevel(zones);
      const state = createBattle(level, "normal", 1);
      run(state, level, 1, [
        { kind: "placeTower", slotId: level.slots[0].id, characterId: "shiro" },
        { kind: "startWave" },
      ]);

      for (let step = 0; step < seconds(20); step += 1) {
        stepSimulation(state, level, [], STEP_MS);
        if (state.towers[0].totalDamage > 0) return step;
      }
      throw new Error("這座塔整整二十秒都沒打到東西");
    };

    const slot = makeLevel([]).slots[0];
    const pooled = firstHitStep([
      { kind: "sugarPool", x: slot.x, y: slot.y, radius: 60 },
    ]);

    expect(pooled).toBeLessThan(firstHitStep([]));
  });
});

describe("ovenVent", () => {
  it("burns enemies inside it on a timer", () => {
    const level = makeLevel([
      // 路上 x=300 的位置正上方，半徑蓋住路面
      { kind: "ovenVent", x: 300, y: 300, radius: 90 },
    ]);
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    // 軟糖 56px/s，走到 x=300 大約 6.4 秒；噴火間隔 6 秒。
    run(state, level, seconds(OVEN_VENT_INTERVAL_MS / 1000 + 3));

    const enemy = state.enemies[0];
    expect(enemy, "怪應該還在路上").toBeDefined();
    expect(enemy.hp).toBeLessThanOrEqual(enemy.maxHp - OVEN_VENT_DAMAGE);
  });

  it("does not fire before its timer is up", () => {
    const level = makeLevel([{ kind: "ovenVent", x: 60, y: 300, radius: 200 }]);
    const state = createBattle(level, "normal", 1);

    run(state, level, 1, [{ kind: "startWave" }]);
    run(state, level, seconds(2));

    const enemy = state.enemies[0];
    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it("keeps the run deterministic", () => {
    const play = () => {
      const level = makeLevel([
        { kind: "ovenVent", x: 300, y: 300, radius: 90 },
      ]);
      const state = createBattle(level, "normal", 7);
      run(state, level, 1, [{ kind: "startWave" }]);
      run(state, level, seconds(12));
      return JSON.stringify({
        kills: state.kills,
        enemies: state.enemies.map((e) => Math.round(e.hp)),
        timers: state.zoneTimers.map(Math.round),
      });
    };

    expect(play()).toBe(play());
  });
});
