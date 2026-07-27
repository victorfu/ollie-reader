import type { TowerArchetype } from "../types";

/**
 * 每種打法的絕招。
 *
 * 57 個角色不可能一人手寫一招，但「打法」只有 8 種，而打法是由主元素決定的——
 * 所以 8 招就蓋得住全部角色，而且抽到新角色時它的絕招是可以預期的（看得懂
 * 「這隻是狙擊」就知道大招會是什麼）。威力另外隨稀有度與等級縮放。
 *
 * 設計取向是「按下去很爽」而不是「算好時機」：主要玩家是小朋友，大招要看得到
 * 整片畫面有反應，而不是數字默默變好看。
 */
export type UltimateSpec = {
  nameZh: string;
  /** 一句話說明，給絕招列的提示與圖鑑用 */
  descZh: string;
};

export const ULTIMATES: Record<TowerArchetype, UltimateSpec> = {
  rapid: {
    nameZh: "彈幕",
    descZh: "三秒內打得超級快。",
  },
  syrup: {
    nameZh: "糖漿大浪",
    descZh: "整片糖漿蓋過去，怪全部變慢。",
  },
  vine: {
    nameZh: "藤蔓爆發",
    descZh: "腳邊長出藤蔓，一直扣血。",
  },
  sniper: {
    nameZh: "必中一擊",
    descZh: "對血最多的那隻打一發超痛的。",
  },
  lullaby: {
    nameZh: "全體睡著",
    descZh: "附近的怪全部睡著站在原地。",
  },
  burst: {
    nameZh: "煙火",
    descZh: "接連炸五發，炸滿整個射程。",
  },
  cannon: {
    nameZh: "碎裂砲",
    descZh: "射程內全部重擊，護甲直接碎掉。",
  },
  cheer: {
    nameZh: "大合唱",
    descZh: "六秒內全場夥伴都打得更快。",
  },
};

/** 絕招的數值。跟 TRAIT_BASE 一樣，平衡時集中改這裡。 */
export const ULTIMATE_BASE = {
  /** 彈幕：持續時間與攻速倍率 */
  rapid: { durationMs: 3000, speedMultiplier: 4 },
  /** 糖漿大浪：射程倍率、減速比例、持續時間 */
  syrup: { rangeMultiplier: 2, slowFactor: 0.5, durationMs: 4000 },
  /** 藤蔓爆發：每秒傷害與持續時間 */
  vine: { dps: 26, durationMs: 5000 },
  /** 必中一擊：傷害倍率 */
  sniper: { damageMultiplier: 8 },
  /** 全體睡著：暈眩時間 */
  lullaby: { stunMs: 2500 },
  /** 煙火：爆炸次數與每次的傷害倍率 */
  burst: { blasts: 5, damageMultiplier: 1.4 },
  /** 碎裂砲：傷害倍率與直接削掉的護甲 */
  cannon: { damageMultiplier: 3, armorShred: 0.4 },
  /** 大合唱：全場攻速加成與持續時間 */
  cheer: { speedBonus: 0.8, durationMs: 6000 },
} as const;

/**
 * 充能。
 *
 * 兩條路一起加：時間讓不造成傷害的應援塔也充得起來，傷害讓認真在打的塔充得
 * 更快。同一個角色放好幾座塔時充能會加總，滿了之後那幾座一起放招——放越多
 * 越快也越猛，對小朋友來說是看得懂的獎勵。
 */
export const CHARGE_TIME_MS = 26_000;
export const CHARGE_PER_DAMAGE = 1 / 900;

/**
 * 隊伍大絕招「甜心總動員」。
 *
 * 角色的絕招之上再疊一層：每放一次夥伴的絕招，隊伍量表就漲一格，三格集滿
 * 按下去，上場的甜心全員衝出來把**整張地圖**的怪打一遍——不看塔的射程，
 * 躲在地圖另一頭的怪也逃不掉。
 *
 * 充能故意只走「放絕招」這一條路，不隨時間慢慢漲：小朋友要看得懂
 * 「按小顆的 → 大顆的亮起來」這條因果鏈，兩條被動量表只會變成背景雜訊。
 */
export const TEAM_ULTIMATE = {
  nameZh: "甜心總動員",
  descZh: "全隊衝出來，把地圖上每一隻怪都打一遍！放夥伴的絕招來充能。",
} as const;

export const TEAM_ULTIMATE_BASE = {
  /**
   * 每一位「上場的隊員」對每隻怪造成的傷害。全隊五人到齊就是 5 倍——
   * 「帶滿隊伍、全部放上場」要看得到回報。跟烤箱口一樣不吃護甲與元素克制：
   * 這是全員撲上去圍毆，不是某座塔在射擊。
   */
  damagePerMember: 26,
  /** 被圍毆嚇到，全場小小定住一下。刻意遠短於「全體睡著」（2500ms），不搶戲。 */
  stunMs: 1000,
} as const;

/** 每放一次角色絕招，隊伍量表漲多少。三次集滿。 */
export const TEAM_CHARGE_PER_CAST = 1 / 3;
