import { buildWaves } from "./waveBuilder";
import type { LevelSpec } from "../types";

/**
 * 十二張地圖。座標都是 1280×720 的邏輯座標，畫面再 letterbox 縮放上去。
 *
 * 路徑最後一點就是櫃檯：怪物走到那裡就會偷走蛋糕。塔位不在這裡寫死——
 * 關卡只說「我要幾個」，實際座標由 data/slotPlanner.ts 沿著路徑排出來，
 * 所以每個塔位天生就打得到路。手打座標的年代有一半的塔位是空砲位。
 *
 * 路線長度不必嚴格遞增，但 levels.test.ts 擋著兩件事：沒有一條路短於
 * 2400px，而且壓軸關不能是全部裡最短的。改版前最後一關 22 秒就被走完
 *（比第一關還短），難度曲線整個是亂的。
 *
 * 波表由 waveBuilder 依「節奏 + 強度」產生，這裡只描述每張地圖有哪些怪、
 * 難度大概多高——想重新平衡就是改 intensity。
 */

/**
 * 地圖 1「店門小徑」——教學關。只有三種怪，先熟悉放塔、升級、元素克制。
 *
 * 三條橫向長廊來回折返，全長約 3850px（舊版 2570px）。最快的棉花糖飛賊
 * 從 24 秒變成 35 秒才走得到櫃檯，玩家看得到「擋下來了」的過程。
 *
 * 長廊間距是 280 / 250px，這個數字是調出來的：塔位站在兩條長廊中間時離
 * 各 88 與 162–192px，射程 156 的速射只打得到自己那條，射程 195 的重砲和
 * 338 的狙擊才吃得到來回兩趟。第一版把間距壓到 200px，結果每個塔位都能守
 * 兩條路，防守強度直接翻倍——挑戰難度連亂擺一通都打得過，敵人數量開到 2.8
 * 倍也殺不動。射程差異變得有意義，選角才有取捨。
 */
const SHOP_PATH: LevelSpec = {
  id: "shop-path",
  nameZh: "店門小徑",
  paths: [
    [
      { x: -60, y: 90 },
      { x: 1150, y: 90 },
      { x: 1150, y: 370 },
      { x: 130, y: 370 },
      { x: 130, y: 620 },
      { x: 1150, y: 620 },
      { x: 1215, y: 620 },
    ],
  ],
  slotPlan: { count: 12 },
  waves: buildWaves({
    swarm: ["gumdrop"],
    rush: ["marshmallow"],
    tank: ["chocolate"],
    bosses: ["pudding-king"],
    intensity: 1,
    pathCount: 1,
  }),
  hpScale: 1.3,
  startingFrosting: 425,
  theme: {
    floor: "#fdf1e3",
    floorEdge: "#f0dcc4",
    path: "#e6c9a8",
    pathEdge: "#cba985",
    accent: "#ff9ec4",
  },
  coinReward: { clear: 60, threeStars: 40 },
};

/**
 * 地圖 2「廚房十字」——兩條走道在開頭真的交叉一次，然後併成一條共用主幹。
 *
 * 兩條路各自繞完全程的話，光是路面就佔掉畫布三分之一，而且會擠到沒地方放塔。
 * 交叉留在入口段，剩下的長度走同一條路。
 */
const KITCHEN_CROSS: LevelSpec = {
  id: "kitchen-cross",
  nameZh: "廚房十字",
  paths: [
    [
      { x: -60, y: 120 },
      { x: 300, y: 120 },
      { x: 300, y: 460 },
      { x: 460, y: 460 },
      { x: 460, y: 640 },
      { x: 700, y: 640 },
      { x: 700, y: 320 },
      { x: 940, y: 320 },
      { x: 940, y: 640 },
      { x: 1160, y: 640 },
      { x: 1160, y: 200 },
      { x: 1210, y: 200 },
    ],
    [
      { x: -60, y: 460 },
      { x: 180, y: 460 },
      { x: 180, y: 240 },
      { x: 460, y: 240 },
      { x: 460, y: 460 },
      { x: 460, y: 640 },
      { x: 700, y: 640 },
      { x: 700, y: 320 },
      { x: 940, y: 320 },
      { x: 940, y: 640 },
      { x: 1160, y: 640 },
      { x: 1160, y: 200 },
      { x: 1210, y: 200 },
    ],
  ],
  slotPlan: { count: 12 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow"],
    tank: ["chocolate"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.1,
    pathCount: 2,
  }),
  // 多一條路等於防線要拆成兩半，開場的錢得夠蓋兩邊，不然第一波就會漏。
  startingFrosting: 578,
  theme: {
    floor: "#eef4f7",
    floorEdge: "#d8e4ea",
    path: "#c9dbe4",
    pathEdge: "#a6c1cd",
    accent: "#5bb8e8",
  },
  coinReward: { clear: 70, threeStars: 45 },
};

/** 地圖 3「冰淇淋長廊」——長折返走廊，飛行的糖霜幽靈會抄對角線。 */
const PARLOUR_HALL: LevelSpec = {
  id: "parlour-hall",
  nameZh: "冰淇淋長廊",
  paths: [
    [
      { x: -60, y: 120 },
      { x: 980, y: 120 },
      { x: 980, y: 300 },
      { x: 300, y: 300 },
      { x: 300, y: 480 },
      { x: 980, y: 480 },
      { x: 980, y: 650 },
      { x: 1210, y: 650 },
    ],
  ],
  slotPlan: { count: 14 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost"],
    tank: ["chocolate"],
    bosses: ["macaron-queen", "pudding-king"],
    intensity: 1.3,
    pathCount: 1,
  }),
  startingFrosting: 527,
  theme: {
    floor: "#fdf0f5",
    floorEdge: "#f3dbe5",
    path: "#f0cbdb",
    pathEdge: "#d9a6bd",
    accent: "#ff6f9f",
  },
  coinReward: { clear: 80, threeStars: 50 },
};

/** 地圖 4「倉庫迴圈」——繞一大圈後穿過自己，並且開始出免疫減速的棒棒糖。 */
const STOCKROOM_LOOP: LevelSpec = {
  id: "stockroom-loop",
  nameZh: "倉庫迴圈",
  paths: [
    [
      { x: -60, y: 380 },
      { x: 160, y: 380 },
      { x: 160, y: 120 },
      { x: 1080, y: 120 },
      { x: 1080, y: 600 },
      { x: 380, y: 600 },
      { x: 380, y: 280 },
      { x: 880, y: 280 },
      { x: 880, y: 450 },
      { x: 1210, y: 450 },
    ],
  ],
  slotPlan: { count: 16 },
  waves: buildWaves({
    swarm: ["soda", "gumdrop"],
    rush: ["marshmallow", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.35,
    pathCount: 1,
  }),
  startingFrosting: 578,
  theme: {
    floor: "#f2f0e6",
    floorEdge: "#e0dcc9",
    path: "#d8cfae",
    pathEdge: "#b6ab84",
    accent: "#f7c948",
  },
  coinReward: { clear: 90, threeStars: 55 },
};

/** 地圖 5「糖果工廠」——三個入口各繞一段，到最後四分之一才匯流。 */
const CANDY_FACTORY: LevelSpec = {
  id: "candy-factory",
  nameZh: "糖果工廠",
  paths: [
    [
      { x: -60, y: 100 },
      { x: 240, y: 100 },
      { x: 240, y: 240 },
      { x: 440, y: 240 },
      { x: 440, y: 620 },
      { x: 620, y: 620 },
      { x: 620, y: 120 },
      { x: 860, y: 120 },
      { x: 860, y: 620 },
      { x: 1100, y: 620 },
      { x: 1100, y: 120 },
      { x: 1210, y: 120 },
    ],
    [
      { x: -60, y: 380 },
      { x: 240, y: 380 },
      { x: 240, y: 240 },
      { x: 440, y: 240 },
      { x: 440, y: 620 },
      { x: 620, y: 620 },
      { x: 620, y: 120 },
      { x: 860, y: 120 },
      { x: 860, y: 620 },
      { x: 1100, y: 620 },
      { x: 1100, y: 120 },
      { x: 1210, y: 120 },
    ],
    [
      { x: -60, y: 660 },
      { x: 140, y: 660 },
      { x: 140, y: 300 },
      { x: 300, y: 300 },
      { x: 300, y: 620 },
      { x: 440, y: 620 },
      { x: 620, y: 620 },
      { x: 620, y: 120 },
      { x: 860, y: 120 },
      { x: 860, y: 620 },
      { x: 1100, y: 620 },
      { x: 1100, y: 120 },
      { x: 1210, y: 120 },
    ],
  ],
  slotPlan: { count: 18 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.5,
    pathCount: 3,
  }),
  // 三個入口，開場至少要能一條路擺兩座。
  startingFrosting: 731,
  theme: {
    floor: "#f6eefc",
    floorEdge: "#e5d9f0",
    path: "#dcc9ee",
    pathEdge: "#b79cd6",
    accent: "#c39cf0",
  },
  coinReward: { clear: 100, threeStars: 60 },
};

/** 地圖 6「巧克力噴泉」——由外向內盤旋，越靠近中心圈越小。 */
const CHOCOLATE_FOUNTAIN: LevelSpec = {
  id: "chocolate-fountain",
  nameZh: "巧克力噴泉",
  paths: [
    [
      { x: -60, y: 140 },
      { x: 1100, y: 140 },
      { x: 1100, y: 540 },
      { x: 260, y: 540 },
      { x: 260, y: 300 },
      { x: 940, y: 300 },
      { x: 940, y: 420 },
      { x: 560, y: 420 },
    ],
  ],
  slotPlan: { count: 18 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["macaron-queen", "cake-titan"],
    intensity: 1.55,
    pathCount: 1,
  }),
  startingFrosting: 646,
  theme: {
    floor: "#f5ece4",
    floorEdge: "#e2d2c3",
    path: "#d3a87f",
    pathEdge: "#a2764f",
    accent: "#8b5e3c",
  },
  coinReward: { clear: 110, threeStars: 65 },
};

/** 地圖 7「棉花糖雲梯」——兩條路上下交叉換邊，一直互相穿過。 */
const MARSHMALLOW_STAIRS: LevelSpec = {
  id: "marshmallow-stairs",
  nameZh: "棉花糖雲梯",
  paths: [
    [
      { x: -60, y: 110 },
      { x: 200, y: 110 },
      { x: 200, y: 360 },
      { x: 390, y: 360 },
      { x: 390, y: 80 },
      { x: 580, y: 80 },
      { x: 580, y: 640 },
      { x: 770, y: 640 },
      { x: 770, y: 80 },
      { x: 960, y: 80 },
      { x: 960, y: 640 },
      { x: 1150, y: 640 },
      { x: 1150, y: 330 },
      { x: 1210, y: 330 },
    ],
    [
      { x: -60, y: 610 },
      { x: 200, y: 610 },
      { x: 200, y: 360 },
      { x: 390, y: 360 },
      { x: 390, y: 80 },
      { x: 580, y: 80 },
      { x: 580, y: 640 },
      { x: 770, y: 640 },
      { x: 770, y: 80 },
      { x: 960, y: 80 },
      { x: 960, y: 640 },
      { x: 1150, y: 640 },
      { x: 1150, y: 330 },
      { x: 1210, y: 330 },
    ],
  ],
  slotPlan: { count: 19 },
  waves: buildWaves({
    swarm: ["soda", "gumdrop"],
    rush: ["marshmallow", "frosting-ghost", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["cake-titan", "macaron-queen"],
    intensity: 1.65,
    pathCount: 2,
  }),
  startingFrosting: 782,
  theme: {
    floor: "#fdf4f8",
    floorEdge: "#f0dde6",
    path: "#f6dbe6",
    pathEdge: "#dcaec2",
    accent: "#ff9ec4",
  },
  coinReward: { clear: 120, threeStars: 70 },
};

/**
 * 地圖 8「蛋糕大廳」——四個入口全開，最後併成一條很長的共用終段。
 *
 * 四個入口刻意只有很短的引道就匯流：讓四條路各自繞完全程的話，畫面會變成
 * 一團互相疊在一起、看不出哪條是哪條的義大利麵。現在是四條短引道 + 一條看
 * 得清楚的長路，開場仍然要同時顧四個方向。
 */
const CAKE_HALL: LevelSpec = {
  id: "cake-hall",
  nameZh: "蛋糕大廳",
  paths: [
    [
      { x: -60, y: 80 },
      { x: 140, y: 80 },
      { x: 140, y: 350 },
      { x: 300, y: 350 },
      { x: 300, y: 120 },
      { x: 1100, y: 120 },
      { x: 1100, y: 280 },
      { x: 420, y: 280 },
      { x: 420, y: 440 },
      { x: 1100, y: 440 },
      { x: 1100, y: 600 },
      { x: 420, y: 600 },
      { x: 420, y: 690 },
      { x: 1210, y: 690 },
    ],
    [
      { x: -60, y: 260 },
      { x: 140, y: 260 },
      { x: 140, y: 350 },
      { x: 300, y: 350 },
      { x: 300, y: 120 },
      { x: 1100, y: 120 },
      { x: 1100, y: 280 },
      { x: 420, y: 280 },
      { x: 420, y: 440 },
      { x: 1100, y: 440 },
      { x: 1100, y: 600 },
      { x: 420, y: 600 },
      { x: 420, y: 690 },
      { x: 1210, y: 690 },
    ],
    [
      { x: -60, y: 440 },
      { x: 140, y: 440 },
      { x: 140, y: 350 },
      { x: 300, y: 350 },
      { x: 300, y: 120 },
      { x: 1100, y: 120 },
      { x: 1100, y: 280 },
      { x: 420, y: 280 },
      { x: 420, y: 440 },
      { x: 1100, y: 440 },
      { x: 1100, y: 600 },
      { x: 420, y: 600 },
      { x: 420, y: 690 },
      { x: 1210, y: 690 },
    ],
    [
      { x: -60, y: 620 },
      { x: 140, y: 620 },
      { x: 140, y: 350 },
      { x: 300, y: 350 },
      { x: 300, y: 120 },
      { x: 1100, y: 120 },
      { x: 1100, y: 280 },
      { x: 420, y: 280 },
      { x: 420, y: 440 },
      { x: 1100, y: 440 },
      { x: 1100, y: 600 },
      { x: 420, y: 600 },
      { x: 420, y: 690 },
      { x: 1210, y: 690 },
    ],
  ],
  slotPlan: { count: 19 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["macaron-queen", "cake-titan"],
    intensity: 1.75,
    pathCount: 4,
  }),
  startingFrosting: 952,
  theme: {
    floor: "#fff6ea",
    floorEdge: "#f0e0cd",
    path: "#f5d7b8",
    pathEdge: "#d3ab84",
    accent: "#f7c948",
  },
  coinReward: { clear: 140, threeStars: 80 },
};

/** 地圖「餅乾迴廊」——三條長直道摺成的迴廊，練習把火力集中在轉角。 */
const COOKIE_CORRIDOR: LevelSpec = {
  id: "cookie-corridor",
  nameZh: "餅乾迴廊",
  paths: [
    [
      { x: -60, y: 180 },
      { x: 950, y: 180 },
      { x: 950, y: 420 },
      { x: 280, y: 420 },
      { x: 280, y: 650 },
      { x: 1210, y: 650 },
    ],
  ],
  slotPlan: { count: 13 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow"],
    tank: ["chocolate"],
    bosses: ["pudding-king", "macaron-queen"],
    intensity: 1.2,
    pathCount: 1,
  }),
  startingFrosting: 500,
  theme: {
    floor: "#fbf0dd",
    floorEdge: "#eddcbc",
    path: "#dfc294",
    pathEdge: "#bfa06e",
    accent: "#d98f4e",
  },
  coinReward: { clear: 75, threeStars: 45 },
};

/**
 * 地圖「果醬瀑布」——兩個入口從上緣進來，匯流後往右一路直落的瀑布群。
 *
 * 兩個入口都放在畫面左半、櫃檯放右下：第一版把右邊的入口放在 (1120,-60)、
 * 櫃檯在 (1210,260)，糖霜幽靈直線飛過去只有 332px，四秒就偷到蛋糕，
 * 什麼塔都來不及反應。入口跟櫃檯的直線距離是飛行怪的實際路程，擺位時
 * 必須跟走地路線一起看。
 */
const JAM_FALLS: LevelSpec = {
  id: "jam-falls",
  nameZh: "果醬瀑布",
  paths: [
    [
      { x: 160, y: -60 },
      { x: 160, y: 140 },
      { x: 400, y: 140 },
      { x: 400, y: 620 },
      { x: 600, y: 620 },
      { x: 600, y: 220 },
      { x: 800, y: 220 },
      { x: 800, y: 620 },
      { x: 1000, y: 620 },
      { x: 1000, y: 220 },
      { x: 1180, y: 220 },
      { x: 1180, y: 560 },
      { x: 1210, y: 560 },
    ],
    [
      { x: 640, y: -60 },
      { x: 640, y: 140 },
      { x: 400, y: 140 },
      { x: 400, y: 620 },
      { x: 600, y: 620 },
      { x: 600, y: 220 },
      { x: 800, y: 220 },
      { x: 800, y: 620 },
      { x: 1000, y: 620 },
      { x: 1000, y: 220 },
      { x: 1180, y: 220 },
      { x: 1180, y: 560 },
      { x: 1210, y: 560 },
    ],
  ],
  slotPlan: { count: 17 },
  waves: buildWaves({
    swarm: ["soda", "gumdrop"],
    rush: ["marshmallow", "frosting-ghost"],
    tank: ["chocolate", "lollipop"],
    bosses: ["macaron-queen", "pudding-king"],
    intensity: 1.45,
    pathCount: 2,
  }),
  startingFrosting: 700,
  theme: {
    floor: "#fdeef2",
    floorEdge: "#f3d3dd",
    path: "#efb8c9",
    pathEdge: "#d18ba1",
    accent: "#e05c81",
  },
  coinReward: { clear: 95, threeStars: 60 },
};

/** 地圖「蜂蜜漩渦」——先直衝到中心，再一圈一圈往外繞出去。 */
const HONEY_SWIRL: LevelSpec = {
  id: "honey-swirl",
  nameZh: "蜂蜜漩渦",
  paths: [
    [
      { x: -60, y: 360 },
      { x: 720, y: 360 },
      { x: 720, y: 480 },
      { x: 480, y: 480 },
      { x: 480, y: 240 },
      { x: 880, y: 240 },
      { x: 880, y: 600 },
      { x: 320, y: 600 },
      { x: 320, y: 120 },
      { x: 1040, y: 120 },
      { x: 1040, y: 640 },
      { x: 1210, y: 640 },
    ],
  ],
  slotPlan: { count: 18 },
  waves: buildWaves({
    swarm: ["soda", "gumdrop"],
    rush: ["frosting-ghost", "marshmallow", "lollipop"],
    tank: ["chocolate", "lollipop"],
    bosses: ["cake-titan", "macaron-queen"],
    intensity: 1.6,
    pathCount: 1,
  }),
  startingFrosting: 750,
  theme: {
    floor: "#fdf6e0",
    floorEdge: "#efe1b8",
    path: "#ecd28e",
    pathEdge: "#c9a95e",
    accent: "#d9a13a",
  },
  coinReward: { clear: 115, threeStars: 70 },
};

/** 地圖「拐杖糖山道」——由下往上四條長髮夾彎，一條路吃滿整張圖。 */
const CANDY_CANE_PASS: LevelSpec = {
  id: "candy-cane-pass",
  nameZh: "拐杖糖山道",
  paths: [
    [
      { x: -60, y: 650 },
      { x: 1150, y: 650 },
      { x: 1150, y: 470 },
      { x: 130, y: 470 },
      { x: 130, y: 290 },
      { x: 1150, y: 290 },
      { x: 1150, y: 110 },
      { x: 1210, y: 110 },
    ],
  ],
  slotPlan: { count: 19 },
  waves: buildWaves({
    swarm: ["gumdrop", "soda"],
    rush: ["marshmallow", "frosting-ghost", "lollipop"],
    tank: ["lollipop", "chocolate"],
    bosses: ["macaron-queen", "cake-titan"],
    intensity: 1.7,
    pathCount: 1,
  }),
  startingFrosting: 850,
  theme: {
    floor: "#fdf2f0",
    floorEdge: "#f2d8d4",
    path: "#eec3bd",
    pathEdge: "#d1948c",
    accent: "#e0555f",
  },
  coinReward: { clear: 130, threeStars: 75 },
};

export const LEVELS: LevelSpec[] = [
  SHOP_PATH,
  KITCHEN_CROSS,
  COOKIE_CORRIDOR,
  PARLOUR_HALL,
  STOCKROOM_LOOP,
  JAM_FALLS,
  CANDY_FACTORY,
  CHOCOLATE_FOUNTAIN,
  HONEY_SWIRL,
  MARSHMALLOW_STAIRS,
  CANDY_CANE_PASS,
  CAKE_HALL,
];

export function getLevel(id: string): LevelSpec | undefined {
  return LEVELS.find((level) => level.id === id);
}
