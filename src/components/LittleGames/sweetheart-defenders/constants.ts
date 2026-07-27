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

/**
 * 每關的蛋糕數（生命）。
 *
 * 難度選單拿掉了：三種難度等於同一份內容要平衡三次，而實際上小朋友一律選
 * 輕鬆。改成單一難度之後，關卡的鬆緊由每張圖自己的 hpScale 決定，調整的
 * 對象只剩一個。生命沿用原本輕鬆的 12 塊——漏個一兩隻不該直接輸掉。
 */
export const MAX_CAKES = 12;


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
export const UPGRADE_COST_MULTIPLIER = [0, 1.2, 2.4, 4.2] as const;
/** 每一級的數值倍率（index 0 = 1 級）。 */
export const LEVEL_POWER = [1, 1.45, 2.05, 2.75] as const;
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
