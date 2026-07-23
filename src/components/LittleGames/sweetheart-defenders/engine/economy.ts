import {
  EARLY_START_BONUS_PER_SECOND,
  RARITY_TIERS,
  SELL_REFUND_RATIO,
  UPGRADE_COST_MULTIPLIER,
} from "../constants";
import type { Pet } from "../types";

/** 放一隻寵物上塔位的費用。 */
export function getPlaceCost(pet: Pet): number {
  return RARITY_TIERS[pet.rarity].cost;
}

/** 從 currentLevel 升到下一級的費用。 */
export function getUpgradeCost(pet: Pet, currentLevel: 1 | 2): number {
  return Math.round(
    RARITY_TIERS[pet.rarity].cost * UPGRADE_COST_MULTIPLIER[currentLevel],
  );
}

/** 這座塔到目前為止總共投入了多少糖霜。 */
export function getInvestedCost(pet: Pet, level: 1 | 2 | 3): number {
  let total = getPlaceCost(pet);
  for (let current = 1; current < level; current += 1) {
    total += getUpgradeCost(pet, current as 1 | 2);
  }
  return total;
}

/** 賣掉一座塔退回多少糖霜。 */
export function getSellRefund(pet: Pet, level: 1 | 2 | 3): number {
  return Math.floor(getInvestedCost(pet, level) * SELL_REFUND_RATIO);
}

/**
 * 提早出發的獎勵。準備時間剩越多給越多，鼓勵玩家佈好塔就趕快開打，
 * 而不是每一波都乾等倒數。
 */
export function getEarlyStartBonus(prepRemainingMs: number): number {
  if (prepRemainingMs <= 0) return 0;
  return Math.floor((prepRemainingMs / 1000) * EARLY_START_BONUS_PER_SECOND);
}
