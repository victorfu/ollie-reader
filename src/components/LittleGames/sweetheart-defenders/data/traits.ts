import type { Element, TowerTrait } from "../types";

/**
 * 副元素決定塔的「特性」。
 *
 * 主元素已經決定了打法（速射 / 狙擊 / 重砲…），副元素再疊一層效果上去，
 * 所以 8 種打法 × 8 種特性可以組出 64 種不同的塔——48 隻寵物幾乎每一隻手感
 * 都不一樣，而且全部是從既有的元素資料推出來的，不用另外手寫 48 份設定。
 *
 * 只有單一元素的寵物拿不到特性，改拿「純粹」加成（傷害直接變高），
 * 這樣早期的單元素寵物不會因為少一個元素就完全沒有位置。
 */
export const TRAIT_BY_SECONDARY_ELEMENT: Record<Element, TowerTrait> = {
  spark: "chain",
  tide: "chill",
  leaf: "toxin",
  light: "focus",
  dream: "daze",
  ember: "scorch",
  crystal: "shred",
  star: "encore",
};

export const TRAIT_LABEL_ZH: Record<TowerTrait, string> = {
  pure: "純粹",
  chain: "連鎖",
  chill: "冰霜",
  toxin: "毒液",
  focus: "專注",
  daze: "恍神",
  scorch: "灼燒",
  shred: "碎甲",
  encore: "連擊",
};

export const TRAIT_DESC_ZH: Record<TowerTrait, string> = {
  pure: "只有一種元素，攻擊力比較高。",
  chain: "打中之後會彈到旁邊的怪身上。",
  chill: "打中的怪會變慢一點。",
  toxin: "打中的怪會中毒，血一直掉。",
  focus: "射程更遠，打飛在天上的怪特別痛。",
  daze: "有機會讓怪突然發呆停下來。",
  scorch: "打中的地方會燒起來，旁邊的怪一起扣血。",
  shred: "每打一下就削掉一點護甲，越打越痛。",
  encore: "一直打同一隻怪的話會越打越快。",
};

/** 特性的基準數值。實際效果會再乘上 traitPower（隨稀有度與等級成長）。 */
export const TRAIT_BASE = {
  /** 傷害直接加成，在 getTowerStats 就算進去 */
  pure: { damageBonus: 0.18 },
  /** 命中後彈到附近的敵人，傷害打折 */
  chain: { targets: 1, damageRatio: 0.55, range: 90 },
  /** 附帶減速，跟糖漿塔的減速取較強者 */
  chill: { slowFactor: 0.2, durationMs: 900 },
  /** 持續傷害：低傷害、長時間 */
  toxin: { dps: 4, durationMs: 3000 },
  /** 射程加成 + 對飛行怪加傷，兩者都在 getTowerStats / computeDamage 算 */
  focus: { rangeBonus: 0.2, flyingBonus: 0.5 },
  /** 小機率暈眩 */
  daze: { chance: 0.12, durationMs: 700 },
  /** 命中點小範圍灼燒：高傷害、短時間 */
  scorch: { dps: 8, durationMs: 1600, radius: 42 },
  /** 每次命中削一點護甲，可累積到上限 */
  shred: { perHit: 0.08, max: 0.4 },
  /** 連續打同一隻目標會越打越快 */
  encore: { perHit: 0.08, max: 0.4 },
} as const;

/** 持續傷害的顏色，讓毒和灼燒在畫面上分得出來。 */
export const DOT_COLOR = {
  toxin: "#7ac77a",
  scorch: "#f58a6b",
} as const;
