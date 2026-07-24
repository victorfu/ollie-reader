// 甜心防衛隊 — 調參集中地。改數值請改這裡，不要散落在邏輯裡。

/**
 * 邏輯解析度。畫面用 letterbox 縮放對應到這個座標系。
 *
 * 960×540 對後面幾張圖來說太擠了——路徑、塔位、櫃檯全部黏在一起。放大到
 * 1280×720（同樣 16:9）多出 78% 的面積，路線畫得開，塔位也排得下。
 */
export const WIDTH = 1280;
export const HEIGHT = 720;

/** 固定 timestep：模擬永遠以 60Hz 前進，跟畫面更新率脫鉤。 */
export const STEP_MS = 1000 / 60;
/** 單次 rAF 最多補幾步，避免分頁切回來時一次跑幾千步。 */
export const MAX_STEPS_PER_FRAME = 5;

/** 每關的蛋糕數（生命）。 */
export const CAKES_BY_DIFFICULTY = {
  easy: 12,
  normal: 10,
  hard: 8,
} as const;

/**
 * 敵人血量倍率。
 *
 * 挑戰難度拉到 1.9 是因為副元素特性上線後，一組像樣的塔在 1.4 倍下可以零失血
 * 通關——那就不叫挑戰了。輕鬆維持在 0.7，讓隨便亂放也過得去。
 */
export const HP_SCALE_BY_DIFFICULTY = {
  easy: 0.7,
  normal: 1,
  hard: 1.9,
} as const;

/** 波次之間的準備時間。 */
export const PREP_MS = 20_000;
/** 第一波開始前多給一點時間佈塔。 */
export const FIRST_PREP_MS = 35_000;
/** 提早出發的獎勵：剩餘秒數 × 這個數字。 */
export const EARLY_START_BONUS_PER_SECOND = 2;

/** 稀有度 → 數值倍率與造價。 */
export const RARITY_TIERS = {
  common: { power: 1, cost: 60 },
  uncommon: { power: 1.25, cost: 90 },
  rare: { power: 1.6, cost: 130 },
  warden: { power: 2.1, cost: 190 },
  mythling: { power: 2.8, cost: 260 },
} as const;

/**
 * 升級到 2 / 3 級的費用是造價的幾倍。刻意比放一座新塔還貴——不然只要錢一夠
 * 就無腦全部點滿，中盤就沒有取捨了。
 */
export const UPGRADE_COST_MULTIPLIER = [0, 1.2, 2.4] as const;
/** 每一級的數值倍率（index 0 = 1 級）。 */
export const LEVEL_POWER = [1, 1.45, 2.05] as const;
/** 賣出退回已投入成本的比例。 */
export const SELL_REFUND_RATIO = 0.6;

/** 副元素對「被它克制的敵人」額外加成。 */
export const SECONDARY_ELEMENT_BONUS = 0.2;

/** 塔位與塔的繪製尺寸，跟著畫布一起放大。 */
export const SLOT_RADIUS = 28;
export const TOWER_SPRITE_SIZE = 60;
/** 路面寬度。renderer 照這個畫，地圖的幾何檢查也照這個算路面佔多少畫布。 */
export const PATH_WIDTH = 60;

/** 三星門檻：剩餘蛋糕比例。 */
export const THREE_STAR_CAKE_RATIO = 1;
export const TWO_STAR_CAKE_RATIO = 0.7;

/**
 * 一場最多帶幾種角色。收藏全上陣就沒有「賽前搭配隊伍」的取捨了；
 * 五隻剛好塞得進 TowerPanel 一排，也逼玩家在八種打法裡做選擇。
 */
export const MAX_SQUAD_SIZE = 5;
