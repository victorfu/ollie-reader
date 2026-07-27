import { describe, expect, it } from "vitest";
import { LEVELS, getLevel } from "./levels";
import { getEnemy } from "./enemies";
import { getCharacter, DEFAULT_ROSTER_IDS } from "./characters";
import { HEIGHT, PATH_WIDTH, SLOT_RADIUS, STEP_MS, WIDTH } from "../constants";
import { ARCHETYPE_BASE } from "./elements";
import { pathCoverage, planSlots } from "./slotPlanner";
import { distanceToPath } from "../engine/path";
import { getPlaceCost } from "../engine/economy";
import {
  compileLevel,
  createBattle,
  stepSimulation,
} from "../engine/simulation";
import { previewWave } from "../engine/waves";
import type { Command, Difficulty, LevelSpec } from "../types";

function pathLength(points: { x: number; y: number }[]): number {
  return points
    .slice(1)
    .reduce(
      (total, point, i) =>
        total + Math.hypot(point.x - points[i].x, point.y - points[i].y),
      0,
    );
}

/** 路面半寬 + 塔位半徑：小於這個距離，塔看起來就是蓋在路中間。 */
const PATH_HALF_WIDTH = PATH_WIDTH / 2;
const MIN_SLOT_CLEARANCE = PATH_HALF_WIDTH + SLOT_RADIUS;

/** 射程最短的打法（藤蔓）。塔位再怎麼樣也要在這個距離內打得到路。 */
const SHORTEST_RANGE = ARCHETYPE_BASE.vine.range;
/** 速射的射程，用來衡量「這個塔位有多少路可以打」。 */
const TYPICAL_RANGE = ARCHETYPE_BASE.rapid.range;

const PLANNED = new Map(
  LEVELS.map((level) => [level.id, planSlots(level.paths, level.slotPlan)]),
);

function slotsOf(level: (typeof LEVELS)[number]) {
  return PLANNED.get(level.id)!;
}

/**
 * 還沒重畫過的地圖。
 *
 * 改版是一張一張做的：先把店門小徑用新規則做到好玩，再往後套。這些圖的路線
 * 還是舊的長直線，沒有折返段，所以塔位涵蓋率過不了新標準——那正是它們還沒
 * 被重畫的證據，不是測試訂太嚴。
 *
 * **這個集合每重畫一張就要移掉一個，最後要變成空的。** 已經重畫過的地圖不准
 * 加進來（底下有一條測試擋著）。
 */
const PENDING_REDESIGN = new Set([
  "cookie-corridor",
  "parlour-hall",
  "stockroom-loop",
  "chocolate-fountain",
  "honey-swirl",
]);

const REDESIGNED = LEVELS.filter((level) => !PENDING_REDESIGN.has(level.id));

describe("level geometry", () => {
  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s keeps every tower slot off the path",
    (_name, level) => {
      for (const slot of slotsOf(level)) {
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
      for (const slot of slotsOf(level)) {
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
      const ids = slotsOf(level).map((slot) => slot.id);
      expect(ids).toHaveLength(new Set(ids).size);
    },
  );

  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s gives every tower slot road within reach",
    (_name, level) => {
      // 這條是塔位從手打改成沿路生成的主因：以前 {x:40,y:30}（左上角，離路
      // 300px 以上）也能過測試，放上去的塔一整場都在放空。
      for (const slot of slotsOf(level)) {
        const nearest = Math.min(
          ...level.paths.map((path) => distanceToPath(slot, path)),
        );

        expect(
          nearest,
          `塔位 ${slot.id} 離路 ${Math.round(nearest)}px，連射程最短的藤蔓都打不到`,
        ).toBeLessThanOrEqual(SHORTEST_RANGE);
      }
    },
  );

  it.each(REDESIGNED.map((level) => [level.nameZh, level] as const))(
    "%s gives every tower slot enough road to work on",
    (_name, level) => {
      // 「離路很近」還不夠——貼在死巷口的塔位怪只會經過一瞬間。這裡量的是
      // 射程內涵蓋多少路徑長度，也就是「怪會在我的射程裡走多久」。折返段
      // 中間的塔位會明顯較高，因為來回兩趟都在射程裡。
      const coverage = slotsOf(level)
        .map((slot) => pathCoverage(slot, level.paths, TYPICAL_RANGE))
        .sort((a, b) => a - b);

      const median = coverage[Math.floor(coverage.length / 2)];

      // 下限 180 是這條測試的主要目的：擋掉「放上去等於沒放」的塔位。
      //
      // 中位數只要求 240 而不是更高，是因為兩者會打架：要讓中位數上到 400，
      // 折返段的間距得壓到 200px 以內，於是**每個**塔位都同時守得住來回兩趟，
      // 防守強度直接翻倍——實測店門小徑那一版連挑戰難度都能亂擺一通打過，
      // 敵人數量開到 2.8 倍還是殺不動。間距拉開到 280/250px 之後，射程 156 的
      // 速射只守得住自己那條，重砲和狙擊才吃得到兩條，射程差異才有意義。
      expect(coverage[0], `最差的塔位只涵蓋 ${coverage[0]}px 的路`).toBeGreaterThanOrEqual(180);
      expect(median, `塔位涵蓋長度的中位數只有 ${median}px`).toBeGreaterThanOrEqual(240);
    },
  );

  it("keeps the redesign backlog honest", () => {
    // 已經重畫過的地圖不准偷偷加進待辦清單來讓測試變綠。
    expect(PENDING_REDESIGN.has("shop-path")).toBe(false);

    for (const id of PENDING_REDESIGN) {
      expect(
        LEVELS.some((level) => level.id === id),
        `待重畫清單裡的 ${id} 已經不存在了`,
      ).toBe(true);
    }
  });

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

  it.each(REDESIGNED.map((level) => [level.nameZh, level] as const))(
    "%s can actually place every slot it asks for",
    (_name, level) => {
      // planSlots 擠不下時會少給，關卡要的數量得是排得出來的數量。
      expect(slotsOf(level)).toHaveLength(level.slotPlan.count);
    },
  );

  it("gives later levels more slots to work with", () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(
        LEVELS[i].slotPlan.count,
        `${LEVELS[i].nameZh} 的塔位不比前一關多`,
      ).toBeGreaterThanOrEqual(LEVELS[i - 1].slotPlan.count);
    }
  });

  /**
   * 這兩條是這次重畫地圖的主因。
   *
   * 改版前最後一關的路線只有 930px、軟糖 22 秒就走完，比第一關的 36 秒還短
   * ——最後一關給塔的時間反而最少。
   *
   * 刻意不要求「每一關都比前一關長」：多路地圖的每條路都要塞進同一個畫布，
   * 硬拉成嚴格遞增只會逼出一堆纏在一起的蛇形路線。真正要守住的是這兩件事：
   * 沒有任何一條路短到不值得防守，而且壓軸關不能是最短的那張。
   */
  it("keeps every route long enough to be worth defending", () => {
    const MIN_PATH_LENGTH = 2400;

    for (const level of LEVELS) {
      for (const [index, path] of level.paths.entries()) {
        expect(
          Math.round(pathLength(path)),
          `${level.nameZh} 第 ${index + 1} 條路線太短`,
        ).toBeGreaterThan(MIN_PATH_LENGTH);
      }
    }
  });

  /**
   * 拉長路線很容易走過頭：多路地圖如果讓每條路都自己繞完全程，路面就會塞滿
   * 整個畫布，變成一團看不出哪條是哪條的義大利麵，而且塔位擠不進路與路之間。
   * 實測過 51% 路面 / 18 次交叉的版本，畫面完全讀不懂。
   *
   * 解法是「入口各走各的、後段共用一條主幹」，這三條就是那個做法的護欄。
   */
  it("never lets the road swallow the whole canvas", () => {
    for (const level of LEVELS) {
      let road = 0;
      let cells = 0;

      for (let x = 0; x <= WIDTH; x += 8) {
        for (let y = 0; y <= HEIGHT; y += 8) {
          cells += 1;
          const nearest = Math.min(
            ...level.paths.map((path) => distanceToPath({ x, y }, path)),
          );
          if (nearest <= PATH_HALF_WIDTH) road += 1;
        }
      }

      expect(
        Math.round((road / cells) * 100),
        `${level.nameZh} 的路面佔掉太多畫布`,
      ).toBeLessThanOrEqual(40);
    }
  });

  it("keeps most of the road within reach of a tower slot", () => {
    // 用中階射程取樣。路鋪得太密時塔位只剩畫布邊緣，怪在中間走一大段沒人打得到。
    const MID_RANGE = 180;

    for (const level of LEVELS) {
      let covered = 0;
      let total = 0;

      for (const path of level.paths) {
        for (let i = 1; i < path.length; i += 1) {
          const from = path[i - 1];
          const to = path[i];
          const steps = Math.max(
            1,
            Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 10),
          );

          for (let step = 0; step < steps; step += 1) {
            const t = (step + 0.5) / steps;
            const point = {
              x: from.x + (to.x - from.x) * t,
              y: from.y + (to.y - from.y) * t,
            };
            if (point.x < 0 || point.x > WIDTH) continue;

            total += 1;
            if (
              slotsOf(level).some(
                (slot) =>
                  Math.hypot(slot.x - point.x, slot.y - point.y) <= MID_RANGE,
              )
            ) {
              covered += 1;
            }
          }
        }
      }

      expect(
        Math.round((covered / total) * 100),
        `${level.nameZh} 有太多路面打不到`,
      ).toBeGreaterThanOrEqual(75);
    }
  });

  it("keeps path crossings rare enough to follow by eye", () => {
    const side = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
    ) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

    for (const level of LEVELS) {
      const segments = level.paths.flatMap((path) =>
        path.slice(1).map((to, i) => [path[i], to] as const),
      );
      let crossings = 0;

      for (let i = 0; i < segments.length; i += 1) {
        // 跳過相鄰的線段：它們本來就共用一個轉角，不算交叉。
        for (let j = i + 2; j < segments.length; j += 1) {
          const [a, b] = segments[i];
          const [c, d] = segments[j];
          if (
            side(a, b, c) * side(a, b, d) < 0 &&
            side(c, d, a) * side(c, d, b) < 0
          ) {
            crossings += 1;
          }
        }
      }

      expect(
        crossings,
        `${level.nameZh} 的路線互相穿過太多次`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it("keeps every flight route long enough to react to", () => {
    /**
     * 飛行怪不走地面路線，直接從入口直線飛到櫃檯（compileFlightPath）。
     * 所以「入口與櫃檯的直線距離」才是飛行怪的實際路程——果醬瀑布第一版
     * 把入口放在 (1120,-60)、櫃檯在 (1210,260)，幽靈 332px、四秒就偷到蛋糕，
     * 塔完全來不及反應，數值怎麼調都救不回來。
     *
     * 下限 600：巧克力噴泉（螺旋進中心，680）是刻意設計的短飛行路線，
     * 要留著；比它更短的都是擺位失誤。
     */
    const MIN_FLIGHT_DISTANCE = 600;

    for (const level of LEVELS) {
      for (const [index, path] of level.paths.entries()) {
        const spawn = path[0];
        const counter = path[path.length - 1];
        expect(
          Math.round(Math.hypot(counter.x - spawn.x, counter.y - spawn.y)),
          `${level.nameZh} 第 ${index + 1} 條路的飛行捷徑太短`,
        ).toBeGreaterThan(MIN_FLIGHT_DISTANCE);
      }
    }
  });

  it("never lets the finale be the shortest walk", () => {
    const shortestRoute = (level: (typeof LEVELS)[number]) =>
      Math.min(...level.paths.map(pathLength));

    const finale = LEVELS[LEVELS.length - 1];

    for (const level of LEVELS.slice(0, -1)) {
      expect(
        Math.round(shortestRoute(finale)),
        `${finale.nameZh} 的最短路線比 ${level.nameZh} 還短`,
      ).toBeGreaterThanOrEqual(Math.round(shortestRoute(level)));
    }
  });
});

describe("level wave tables", () => {
  it.each(LEVELS.map((level) => [level.nameZh, level] as const))(
    "%s runs 10 waves with bosses on 5 and 10",
    (_name, level) => {
      expect(level.waves).toHaveLength(10);

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
      ...DEFAULT_ROSTER_IDS.map((id) => getPlaceCost(getCharacter(id)!)),
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
  /**
   * 「懂遊戲、而且有在抽扭蛋的玩家」會蓋的組合。
   *
   * 角色改由扭蛋解鎖之後，能打到後段的人一定抽過幾隻好的，所以這裡刻意混進
   * 幾個高稀有度的——只用預設班底（全 common）當基準，會把難度標準訂得比
   * 真實情況低太多。
   */
  const GOOD_BUILD = [
    // 便宜的排前面：塔防的錢滾錢是靠先鋪滿防線，先買貴的會鋪不滿、
    // 殺不掉怪、更沒錢，直接掉進死亡螺旋。
    "minna-no-tabo", // ember 爆裂 · 連鎖（common）
    "shiro", // light 狙擊 · 毒液（common）
    "chococat", // crystal 重砲 · 連鎖（common）
    "pochacco", // spark 速射 · 毒液（common）
    "keroppi", // leaf 藤蔓 · 冰霜（common）
    "usahana", // star 應援 · 毒液（common）
    "hiroshi-nohara", // ember 爆裂 · 碎甲（rare）
    "aggretsuko", // ember 爆裂 · 連鎖（rare）
  ];

  function playThrough(
    level: LevelSpec,
    difficulty: Difficulty,
    build: string[],
  ) {
    const compiled = compileLevel(level);
    const state = createBattle(compiled, difficulty, 99);
    const slotIds = compiled.slots.map((slot) => slot.id);
    let placed = 0;
    let upgradeCursor = 0;

    // 20 分鐘的模擬時間，足夠跑完任何一張圖。
    for (let step = 0; step < (20 * 60 * 1000) / STEP_MS; step += 1) {
      const commands: Command[] = [];

      if (placed < slotIds.length) {
        const characterId = build[placed % build.length];
        if (state.frosting >= getPlaceCost(getCharacter(characterId)!)) {
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
      const state = playThrough(level, "easy", DEFAULT_ROSTER_IDS);

      expect(state.phase).toBe("cleared");
    },
  );

  // 八張圖 × 三難度的完整快跑；地圖變長之後跑得比預設 5 秒久。
  it(
    "never reports a clear on the same frame the last cake is stolen",
    { timeout: 30_000 },
    () => {
      // 最後一隻怪同時「離場」與「打穿櫃檯」時，結果必須算輸。
      for (const level of LEVELS) {
        for (const difficulty of ["easy", "normal", "hard"] as Difficulty[]) {
          const state = playThrough(level, difficulty, DEFAULT_ROSTER_IDS);
          if (state.phase === "cleared") {
            expect(
              state.cakes,
              `${level.nameZh}/${difficulty} 在蛋糕歸零時被判定通關`,
            ).toBeGreaterThan(0);
          }
        }
      }
    },
  );
});
