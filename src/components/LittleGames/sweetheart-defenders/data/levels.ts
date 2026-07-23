import { buildWaves } from "./waveBuilder";
import type { LevelSpec } from "../types";

/**
 * 五張地圖。座標都是 960×540 的邏輯座標，畫面再 letterbox 縮放上去。
 *
 * 路徑最後一點就是櫃檯：怪物走到那裡就會偷走蛋糕。塔位刻意放在離路徑
 * 60–110px 的地方，讓射程最短的塔（藤蔓 96）也至少能顧到一段路。
 *
 * 波表由 waveBuilder 依「節奏 + 強度」產生，這裡只描述每張地圖有哪些怪、
 * 難度大概多高——想重新平衡就是改 intensity。
 */

/** 地圖 1「店門小徑」——教學關。只有三種怪，先熟悉放塔、升級、元素克制。 */
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
  waves: buildWaves({
    swarm: ["gumdrop"],
    rush: ["marshmallow"],
    tank: ["chocolate"],
    bosses: ["pudding-king"],
    intensity: 1,
    pathCount: 1,
  }),
  startingFrosting: 250,
  theme: {
    floor: "#fdf1e3",
    floorEdge: "#f0dcc4",
    path: "#e6c9a8",
    pathEdge: "#cba985",
    accent: "#ff9ec4",
  },
  // 通關補齊剩下兩種打法（糖漿、重砲），三星再送兩隻換個特性玩玩。
  coinReward: { clear: 60, threeStars: 40 },
};

/** 地圖 2「廚房十字」——兩條平行走道同時進怪，開始出會分裂的汽水泡泡。 */
const KITCHEN_CROSS: LevelSpec = {
  id: "kitchen-cross",
  nameZh: "廚房十字",
  paths: [
    [
      { x: -40, y: 110 },
      { x: 240, y: 110 },
      { x: 240, y: 250 },
      { x: 660, y: 250 },
      { x: 660, y: 420 },
      { x: 890, y: 420 },
    ],
    [
      { x: -40, y: 470 },
      { x: 240, y: 470 },
      { x: 240, y: 350 },
      { x: 660, y: 350 },
      { x: 660, y: 420 },
      { x: 890, y: 420 },
    ],
  ],
  slots: [
    { id: "k1", x: 120, y: 220 },
    { id: "k2", x: 120, y: 380 },
    { id: "k3", x: 350, y: 180 },
    { id: "k4", x: 350, y: 420 },
    // 正中央這格同時罩得到兩條走道，是這張圖的甜蜜點。
    { id: "k5", x: 450, y: 300 },
    { id: "k6", x: 560, y: 180 },
    { id: "k7", x: 560, y: 420 },
    { id: "k8", x: 745, y: 200 },
    { id: "k9", x: 760, y: 330 },
    { id: "k10", x: 780, y: 510 },
    { id: "k11", x: 890, y: 300 },
  ],
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow"],
    tank: ["chocolate"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.1,
    pathCount: 2,
  }),
  // 多一條路等於防線要拆成兩半，開場的錢得夠蓋兩邊，不然第一波就會漏。
  startingFrosting: 340,
  theme: {
    floor: "#eef4f7",
    floorEdge: "#d8e4ea",
    path: "#c9dbe4",
    pathEdge: "#a6c1cd",
    accent: "#5bb8e8",
  },
  coinReward: { clear: 70, threeStars: 45 },
};

/** 地圖 3「冰淇淋長廊」——超長折返路線，並且開始出會飛的糖霜幽靈。 */
const PARLOUR_HALL: LevelSpec = {
  id: "parlour-hall",
  nameZh: "冰淇淋長廊",
  paths: [
    [
      { x: -40, y: 80 },
      { x: 830, y: 80 },
      { x: 830, y: 210 },
      { x: 130, y: 210 },
      { x: 130, y: 340 },
      { x: 830, y: 340 },
      { x: 830, y: 470 },
      { x: 890, y: 470 },
    ],
  ],
  slots: [
    { id: "p1", x: 80, y: 145 },
    { id: "p2", x: 250, y: 145 },
    { id: "p3", x: 420, y: 145 },
    { id: "p4", x: 590, y: 145 },
    { id: "p5", x: 760, y: 145 },
    { id: "p6", x: 250, y: 275 },
    { id: "p7", x: 420, y: 275 },
    { id: "p8", x: 590, y: 275 },
    { id: "p9", x: 760, y: 275 },
    { id: "p10", x: 250, y: 405 },
    { id: "p11", x: 420, y: 405 },
    { id: "p12", x: 590, y: 405 },
    { id: "p13", x: 745, y: 470 },
  ],
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost"],
    tank: ["chocolate"],
    bosses: ["macaron-queen", "pudding-king"],
    intensity: 1.32,
    pathCount: 1,
  }),
  startingFrosting: 310,
  theme: {
    floor: "#fdf0f5",
    floorEdge: "#f3dbe5",
    path: "#f0cbdb",
    pathEdge: "#d9a6bd",
    accent: "#ff6f9f",
  },
  coinReward: { clear: 80, threeStars: 50 },
};

/** 地圖 4「倉庫迴圈」——路線自己繞回來交叉，並且開始出免疫減速的棒棒糖。 */
const STOCKROOM_LOOP: LevelSpec = {
  id: "stockroom-loop",
  nameZh: "倉庫迴圈",
  paths: [
    [
      { x: -40, y: 300 },
      { x: 160, y: 300 },
      { x: 160, y: 110 },
      { x: 800, y: 110 },
      { x: 800, y: 430 },
      { x: 330, y: 430 },
      { x: 330, y: 250 },
      { x: 890, y: 250 },
    ],
  ],
  slots: [
    { id: "w1", x: 80, y: 200 },
    { id: "w2", x: 80, y: 410 },
    { id: "w3", x: 250, y: 180 },
    { id: "w4", x: 250, y: 350 },
    { id: "w5", x: 420, y: 180 },
    { id: "w6", x: 420, y: 340 },
    { id: "w7", x: 590, y: 180 },
    { id: "w8", x: 590, y: 340 },
    { id: "w9", x: 700, y: 180 },
    { id: "w10", x: 880, y: 110 },
    { id: "w11", x: 880, y: 370 },
    { id: "w12", x: 230, y: 500 },
    { id: "w13", x: 520, y: 500 },
    { id: "w14", x: 700, y: 500 },
  ],
  waves: buildWaves({
    swarm: ["soda", "gumdrop"],
    rush: ["marshmallow", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.3,
    pathCount: 1,
  }),
  startingFrosting: 330,
  theme: {
    floor: "#f2f0e6",
    floorEdge: "#e0dcc9",
    path: "#d8cfae",
    pathEdge: "#b6ab84",
    accent: "#f7c948",
  },
  coinReward: { clear: 90, threeStars: 55 },
};

/** 地圖 5「糖果工廠」——三個入口匯流，全怪種登場，最後是蛋糕巨人。 */
const CANDY_FACTORY: LevelSpec = {
  id: "candy-factory",
  nameZh: "糖果工廠",
  paths: [
    [
      { x: -40, y: 90 },
      { x: 350, y: 90 },
      { x: 350, y: 270 },
      { x: 890, y: 270 },
    ],
    [
      { x: -40, y: 270 },
      { x: 350, y: 270 },
      { x: 890, y: 270 },
    ],
    [
      { x: -40, y: 450 },
      { x: 350, y: 450 },
      { x: 350, y: 270 },
      { x: 890, y: 270 },
    ],
  ],
  slots: [
    { id: "f1", x: 120, y: 180 },
    { id: "f2", x: 120, y: 360 },
    { id: "f3", x: 250, y: 180 },
    { id: "f4", x: 250, y: 360 },
    { id: "f5", x: 440, y: 170 },
    { id: "f6", x: 440, y: 370 },
    { id: "f7", x: 550, y: 170 },
    { id: "f8", x: 550, y: 370 },
    { id: "f9", x: 660, y: 170 },
    { id: "f10", x: 660, y: 370 },
    { id: "f11", x: 770, y: 170 },
    { id: "f12", x: 770, y: 370 },
    { id: "f13", x: 350, y: 500 },
    { id: "f14", x: 350, y: 40 },
    { id: "f15", x: 880, y: 150 },
    { id: "f16", x: 880, y: 390 },
  ],
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["pudding-king", "macaron-queen", "cake-titan"],
    intensity: 1.4,
    pathCount: 3,
  }),
  // 三個入口，開場至少要能一條路擺兩座。
  startingFrosting: 430,
  theme: {
    floor: "#f6eefc",
    floorEdge: "#e5d9f0",
    path: "#dcc9ee",
    pathEdge: "#b79cd6",
    accent: "#c39cf0",
  },
  coinReward: { clear: 100, threeStars: 60 },
};

export const LEVELS: LevelSpec[] = [
  SHOP_PATH,
  KITCHEN_CROSS,
  PARLOUR_HALL,
  STOCKROOM_LOOP,
  CANDY_FACTORY,
];

export function getLevel(id: string): LevelSpec | undefined {
  return LEVELS.find((level) => level.id === id);
}
