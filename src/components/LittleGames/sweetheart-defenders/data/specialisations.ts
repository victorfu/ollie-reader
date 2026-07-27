import type { TowerArchetype } from "../types";

/**
 * 第 4 級的專精分岔。
 *
 * 1→3 級是純數值成長，升到第 4 級時要在兩條路線裡選一條，選了就不能改——
 * 這是 Kingdom Rush 的做法，也是它最好玩的地方：同一座塔在不同場次可以是
 * 完全不同的東西，而且「選哪一條」是玩家自己做的決定，不是系統給的。
 *
 * 一場只做一次選擇，小朋友負擔得起；但八種打法各有兩條路，等於 16 種結果。
 *
 * 每條路線都只改 TowerStats 上既有的欄位（外加一個 extraTargets），
 * 所以模擬層幾乎不用為了分岔多寫邏輯。
 */
export type SpecPath = "a" | "b";

export type Specialisation = {
  nameZh: string;
  descZh: string;
  /** 乘算：套在原本的數值上 */
  damage?: number;
  range?: number;
  /** 小於 1 代表打得更快 */
  cooldown?: number;
  splashRadius?: number;
  /** 加算：直接加在原本的比例上 */
  slowFactor?: number;
  stunChance?: number;
  armorPierce?: number;
  cheerBonus?: number;
  /** 每次攻擊多打幾個目標 */
  extraTargets?: number;
};

export const SPECIALISATIONS: Record<
  TowerArchetype,
  Record<SpecPath, Specialisation>
> = {
  rapid: {
    a: { nameZh: "連珠", descZh: "打得更快，像機關槍一樣。", cooldown: 0.55 },
    b: { nameZh: "散射", descZh: "一次打三隻怪。", extraTargets: 2 },
  },
  syrup: {
    a: {
      nameZh: "冰河",
      descZh: "黏得更牢，範圍也更大。",
      slowFactor: 0.2,
      range: 1.3,
    },
    b: { nameZh: "濃漿", descZh: "糖漿變得很重，打起來真的會痛。", damage: 2.6 },
  },
  vine: {
    a: {
      nameZh: "荊棘",
      descZh: "藤蔓長得更開，一次掃到更多怪。",
      splashRadius: 1.6,
      range: 1.25,
    },
    b: { nameZh: "劇毒", descZh: "藤蔓有毒，扣血變快。", damage: 2 },
  },
  sniper: {
    a: {
      nameZh: "鷹眼",
      descZh: "射得更遠，打得更痛。",
      range: 1.5,
      damage: 1.4,
    },
    b: {
      nameZh: "貫穿",
      descZh: "子彈會穿過去，護甲擋不住。",
      armorPierce: 0.9,
      extraTargets: 1,
    },
  },
  lullaby: {
    a: { nameZh: "沉睡", descZh: "更容易讓怪睡著。", stunChance: 0.25 },
    b: { nameZh: "惡夢", descZh: "夢裡也會痛，傷害變高。", damage: 2.2 },
  },
  burst: {
    a: { nameZh: "大爆炸", descZh: "炸開的範圍大很多。", splashRadius: 1.7 },
    b: { nameZh: "連環", descZh: "炸得又快又連續。", cooldown: 0.5 },
  },
  cannon: {
    a: { nameZh: "攻城", descZh: "一發更重，專門對付硬的。", damage: 1.6 },
    b: {
      nameZh: "碎盾",
      descZh: "護甲直接碎掉，還打得更快。",
      armorPierce: 0.3,
      cooldown: 0.7,
    },
  },
  cheer: {
    a: { nameZh: "領唱", descZh: "夥伴打得更快。", cheerBonus: 0.35 },
    b: { nameZh: "鼓舞", descZh: "照顧得到的夥伴變多。", range: 1.8 },
  },
};

export const SPEC_PATHS: SpecPath[] = ["a", "b"];
