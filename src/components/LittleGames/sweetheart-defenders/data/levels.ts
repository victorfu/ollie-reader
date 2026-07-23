import type { LevelSpec, WaveSpec } from "../types";

/**
 * 關卡資料。座標都是 960×540 的邏輯座標，畫面再 letterbox 縮放上去。
 *
 * 路徑最後一點就是櫃檯：怪物走到那裡就會偷走蛋糕。塔位刻意放在離路徑
 * 60–110px 的地方，讓射程最短的塔（藤蔓 96）也至少能顧到一段路。
 */

/** 波次獎金：越後面的波打完給越多。 */
function bonusForWave(waveIndex: number): number {
  return 15 + waveIndex * 4;
}

function wave(groups: WaveSpec["groups"], waveIndex: number): WaveSpec {
  return { groups, bonus: bonusForWave(waveIndex) };
}

// 地圖 1「店門小徑」——教學關。只出軟糖、棉花糖、巧克力三種怪，
// 讓玩家先熟悉「放塔、升級、看元素克制」這件事。
const SHOP_PATH_WAVES: WaveSpec[] = [
  wave([{ kind: "gumdrop", count: 6, gapMs: 900, delayMs: 0 }], 0),
  wave([{ kind: "gumdrop", count: 8, gapMs: 800, delayMs: 0 }], 1),
  wave(
    [
      { kind: "gumdrop", count: 6, gapMs: 700, delayMs: 0 },
      { kind: "marshmallow", count: 3, gapMs: 700, delayMs: 4000 },
    ],
    2,
  ),
  wave(
    [
      { kind: "marshmallow", count: 8, gapMs: 500, delayMs: 0 },
      { kind: "gumdrop", count: 5, gapMs: 900, delayMs: 1000 },
    ],
    3,
  ),
  // 第 5 波：第一次 Boss
  wave(
    [
      { kind: "pudding-king", count: 1, gapMs: 0, delayMs: 0 },
      { kind: "gumdrop", count: 6, gapMs: 800, delayMs: 2000 },
    ],
    4,
  ),
  wave(
    [
      { kind: "gumdrop", count: 10, gapMs: 600, delayMs: 0 },
      { kind: "chocolate", count: 1, gapMs: 0, delayMs: 5000 },
    ],
    5,
  ),
  wave(
    [
      { kind: "chocolate", count: 3, gapMs: 2500, delayMs: 0 },
      { kind: "marshmallow", count: 6, gapMs: 500, delayMs: 1500 },
    ],
    6,
  ),
  wave(
    [
      { kind: "gumdrop", count: 12, gapMs: 450, delayMs: 0 },
      { kind: "marshmallow", count: 6, gapMs: 400, delayMs: 3000 },
    ],
    7,
  ),
  wave(
    [
      { kind: "chocolate", count: 4, gapMs: 2000, delayMs: 0 },
      { kind: "gumdrop", count: 8, gapMs: 700, delayMs: 1000 },
    ],
    8,
  ),
  // 第 10 波：Boss + 護衛
  wave(
    [
      { kind: "pudding-king", count: 1, gapMs: 0, delayMs: 0 },
      { kind: "chocolate", count: 2, gapMs: 2000, delayMs: 3000 },
      { kind: "marshmallow", count: 6, gapMs: 400, delayMs: 6000 },
    ],
    9,
  ),
  wave([{ kind: "marshmallow", count: 14, gapMs: 350, delayMs: 0 }], 10),
  wave(
    [
      { kind: "chocolate", count: 5, gapMs: 1800, delayMs: 0 },
      { kind: "gumdrop", count: 10, gapMs: 500, delayMs: 1000 },
    ],
    11,
  ),
  wave(
    [
      { kind: "gumdrop", count: 16, gapMs: 350, delayMs: 0 },
      { kind: "chocolate", count: 3, gapMs: 2000, delayMs: 4000 },
    ],
    12,
  ),
  wave(
    [
      { kind: "marshmallow", count: 12, gapMs: 300, delayMs: 0 },
      { kind: "chocolate", count: 4, gapMs: 1800, delayMs: 2000 },
    ],
    13,
  ),
  // 第 15 波：雙 Boss 收尾
  wave(
    [
      { kind: "pudding-king", count: 2, gapMs: 6000, delayMs: 0 },
      { kind: "chocolate", count: 4, gapMs: 2000, delayMs: 2000 },
      { kind: "gumdrop", count: 12, gapMs: 500, delayMs: 4000 },
    ],
    14,
  ),
];

const SHOP_PATH: LevelSpec = {
  id: "shop-path",
  nameZh: "店門小徑",
  paths: [
    [
      { x: -40, y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 330 },
      { x: 400, y: 330 },
      { x: 400, y: 150 },
      { x: 640, y: 150 },
      { x: 640, y: 400 },
      { x: 880, y: 400 },
    ],
  ],
  slots: [
    { id: "s1", x: 100, y: 250 },
    { id: "s2", x: 270, y: 230 },
    { id: "s3", x: 290, y: 430 },
    { id: "s4", x: 500, y: 240 },
    { id: "s5", x: 540, y: 400 },
    { id: "s6", x: 540, y: 88 },
    { id: "s7", x: 740, y: 270 },
    { id: "s8", x: 790, y: 490 },
  ],
  waves: SHOP_PATH_WAVES,
  startingFrosting: 250,
  theme: {
    floor: "#fdf1e3",
    floorEdge: "#f0dcc4",
    path: "#e6c9a8",
    pathEdge: "#cba985",
    accent: "#ff9ec4",
  },
  unlocksOnClear: ["mossmew", "glimmerbun"],
  unlocksOnThreeStars: ["sparkleaf-fawn"],
};

export const LEVELS: LevelSpec[] = [SHOP_PATH];

export function getLevel(id: string): LevelSpec | undefined {
  return LEVELS.find((level) => level.id === id);
}
