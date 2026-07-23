import type { AttackStyle, Element, TowerArchetype } from "../types";

// 元素克制環（沿用 Wonder Academy 的設定）：
// spark -> tide -> ember -> leaf -> crystal -> dream -> star -> light -> (spark)
// 每個元素對「下兩個」造成 2 倍傷害，對「前兩個」只有 0.5 倍。
const STRONG_AGAINST: Record<Element, Element[]> = {
  spark: ["tide", "ember"],
  tide: ["ember", "leaf"],
  ember: ["leaf", "crystal"],
  leaf: ["crystal", "dream"],
  crystal: ["dream", "star"],
  dream: ["star", "light"],
  star: ["light", "spark"],
  light: ["spark", "tide"],
};

export function getEffectiveness(
  attacking: Element,
  defending: Element,
): number {
  if (STRONG_AGAINST[attacking].includes(defending)) return 2;
  if (STRONG_AGAINST[defending].includes(attacking)) return 0.5;
  return 1;
}

/** 主元素決定塔的攻擊原型。 */
export const ARCHETYPE_BY_ELEMENT: Record<Element, TowerArchetype> = {
  spark: "rapid",
  tide: "syrup",
  leaf: "vine",
  light: "sniper",
  dream: "lullaby",
  ember: "burst",
  crystal: "cannon",
  star: "cheer",
};

export const ELEMENT_LABEL_ZH: Record<Element, string> = {
  spark: "閃電",
  tide: "潮汐",
  leaf: "草葉",
  light: "光輝",
  dream: "夢境",
  ember: "火花",
  crystal: "晶石",
  star: "星辰",
};

export const ELEMENT_COLOR: Record<Element, string> = {
  spark: "#f7c948",
  tide: "#5bb8e8",
  leaf: "#7ac77a",
  light: "#ffe8a3",
  dream: "#c39cf0",
  ember: "#f58a6b",
  crystal: "#8fd8d2",
  star: "#f79fc4",
};

/** 每種打法的攻擊視覺。讓 8 種塔在畫面上一眼就分得出來。 */
export const ATTACK_STYLE_BY_ARCHETYPE: Record<TowerArchetype, AttackStyle> = {
  rapid: "bolt",
  syrup: "syrupBlob",
  vine: "groundPulse",
  sniper: "beam",
  lullaby: "note",
  burst: "mortar",
  cannon: "shard",
  cheer: "aura",
};

export const ARCHETYPE_LABEL_ZH: Record<TowerArchetype, string> = {
  rapid: "速射",
  syrup: "糖漿",
  vine: "藤蔓",
  sniper: "狙擊",
  lullaby: "催眠",
  burst: "爆裂",
  cannon: "重砲",
  cheer: "應援",
};

export const ARCHETYPE_DESC_ZH: Record<TowerArchetype, string> = {
  rapid: "打得又快又碎，適合清一大群小怪。",
  syrup: "把怪黏住變慢，自己傷害不高。",
  vine: "在腳邊灑範圍傷害，怪走過去會一直扣血。",
  sniper: "射程超遠、一發很痛，但要等很久。",
  lullaby: "有機率讓怪睡著站在原地。",
  burst: "打中會爆炸，波及旁邊的怪。",
  cannon: "傷害最高又能穿透護甲，可惜很慢。",
  cheer: "不攻擊，但讓旁邊的夥伴打得更快。",
};

/**
 * 每種原型的基礎數值（1 級、common、無倍率）。平衡時主要調這裡。
 * 射程已跟著 1280×720 的畫布放大過。
 */
export const ARCHETYPE_BASE: Record<
  TowerArchetype,
  {
    range: number;
    damage: number;
    cooldownMs: number;
    splashRadius: number;
    slowFactor: number;
    stunChance: number;
    armorPierce: number;
    cheerBonus: number;
  }
> = {
  rapid: {
    range: 156,
    damage: 8,
    cooldownMs: 320,
    splashRadius: 0,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0,
  },
  syrup: {
    range: 146,
    damage: 5,
    cooldownMs: 700,
    splashRadius: 0,
    slowFactor: 0.35,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0,
  },
  vine: {
    range: 125,
    damage: 6,
    cooldownMs: 900,
    splashRadius: 75,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0,
  },
  sniper: {
    range: 338,
    damage: 34,
    cooldownMs: 1600,
    splashRadius: 0,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0,
  },
  lullaby: {
    range: 169,
    damage: 9,
    cooldownMs: 1100,
    splashRadius: 0,
    slowFactor: 0,
    stunChance: 0.25,
    armorPierce: 0,
    cheerBonus: 0,
  },
  burst: {
    range: 176,
    damage: 16,
    cooldownMs: 1000,
    splashRadius: 81,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0,
  },
  cannon: {
    range: 195,
    damage: 40,
    cooldownMs: 1900,
    splashRadius: 0,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0.6,
    cheerBonus: 0,
  },
  cheer: {
    range: 140,
    damage: 0,
    cooldownMs: 0,
    splashRadius: 0,
    slowFactor: 0,
    stunChance: 0,
    armorPierce: 0,
    cheerBonus: 0.25,
  },
};

/** 減速與暈眩的持續時間。 */
export const SLOW_DURATION_MS = 1200;
export const STUN_DURATION_MS = 1000;
