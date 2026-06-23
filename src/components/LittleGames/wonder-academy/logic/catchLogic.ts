import type { WonderAcademyRarity } from "../../../../types/wonderAcademy";
import type { Rng } from "./rng";

export type CatchContext = {
  hpRatio: number;
  rarity: WonderAcademyRarity;
  treatTier: number;
  isFavoriteSnack: boolean;
};

const RARITY_FACTOR: Record<WonderAcademyRarity, number> = {
  common: 1,
  uncommon: 0.85,
  rare: 0.65,
  warden: 0.4,
  mythling: 0.3,
};

const MIN_CHANCE = 0.05;
const MAX_CHANCE = 0.95;
const FAVORITE_SNACK_BONUS = 0.25;
const TREAT_BONUS_PER_TIER = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeCatchChance(ctx: CatchContext): number {
  const hpFactor = 1 - clamp(ctx.hpRatio, 0, 1);
  let chance = hpFactor * RARITY_FACTOR[ctx.rarity];
  chance += ctx.treatTier * TREAT_BONUS_PER_TIER;
  if (ctx.isFavoriteSnack) chance += FAVORITE_SNACK_BONUS;
  return clamp(chance, MIN_CHANCE, MAX_CHANCE);
}

export function attemptCatch(
  ctx: CatchContext,
  rng: Rng,
): { caught: boolean; chance: number } {
  const chance = computeCatchChance(ctx);
  return { caught: rng() < chance, chance };
}
