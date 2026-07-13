import type { SpiritRarity } from "../types/game";

export interface GachaEntry {
  id: string; // 對應 assets/spirits 的精靈 id（於 commit 8 新增，source:"gacha"）
  rarity: SpiritRarity;
  weight: number; // 權重越大越常抽到（公開機率）
}

/**
 * 扭蛋限定精靈池：只放 source:"gacha" 的精靈，避免稀釋關卡/進化取得的精靈。
 * 權重加總不必為 100，pickWeighted 會自動正規化。
 */
export const GACHA_POOL: GachaEntry[] = [
  { id: "sparkle-mochi", rarity: "common", weight: 50 },
  { id: "bubble-jelly", rarity: "uncommon", weight: 30 },
  { id: "rainbow-cloud", rarity: "rare", weight: 15 },
  { id: "cosmic-unicorn", rarity: "legendary", weight: 5 },
];
