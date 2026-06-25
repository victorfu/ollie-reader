export const MAX_BOND = 100;
export const FAVORITE_SNACK_BOND_MULTIPLIER = 2;

export function gainBond(
  currentBond: number,
  amount: number,
  isFavorite: boolean,
): number {
  const gain = isFavorite ? amount * FAVORITE_SNACK_BOND_MULTIPLIER : amount;
  const next = currentBond + gain;
  return Math.min(MAX_BOND, Math.max(0, next));
}
