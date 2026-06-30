export type CatchSnackChoice = {
  snackId: string;
  snacks: Record<string, number>;
  isFavorite: boolean;
  treatTier: number;
};

export function chooseCatchSnack(
  snacks: Record<string, number>,
  favoriteSnack: string | undefined,
  snackOrder: readonly string[],
): CatchSnackChoice | null {
  const favoriteCount = favoriteSnack ? snacks[favoriteSnack] ?? 0 : 0;
  const snackId = favoriteSnack && favoriteCount > 0
    ? favoriteSnack
    : snackOrder.find((id) => (snacks[id] ?? 0) > 0);
  if (!snackId) return null;
  return {
    snackId,
    snacks: { ...snacks, [snackId]: (snacks[snackId] ?? 0) - 1 },
    isFavorite: snackId === favoriteSnack,
    treatTier: 2,
  };
}
