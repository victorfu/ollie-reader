import type { SnackId, ToyId, WishDefinition } from "../types";
import { SNACKS } from "./foods";
import { TOYS } from "./toys";

/** Fixed wishes account for 60% of the pool. The toy group contributes 10%. */
export const FREE_WISHES: readonly WishDefinition[] = [
  { id: "pet-five", nameZh: "想被摸摸五次", nameEn: "Pet me five times", target: 5, action: { type: "pet" }, weight: 20, kind: "free" },
  { id: "bubble-bath", nameZh: "想洗泡泡澡", nameEn: "Take a bubble bath", target: 1, action: { type: "bath" }, weight: 15, kind: "free" },
  { id: "drink-milk", nameZh: "想喝牛奶", nameEn: "Drink some milk", target: 1, action: { type: "feed", foodId: "milk" }, weight: 15, kind: "free" },
  { id: "say-good-night", nameZh: "想聽你說晚安", nameEn: "Say good night", target: 1, action: { type: "sleep" }, weight: 10, kind: "free" },
] as const;

export function makeToyWish(toyId: ToyId, weight: number): WishDefinition {
  const toy = TOYS.find((candidate) => candidate.id === toyId);
  if (!toy) throw new Error(`Unknown cottage toy: ${toyId}`);
  return {
    id: `play-${toyId}`,
    nameZh: `想玩${toy.nameZh}`,
    nameEn: `Play with the ${toy.nameEn}`,
    target: 1,
    action: { type: "play", toyId },
    weight,
    kind: "toy",
  };
}

export const SNACK_WISHES: readonly WishDefinition[] = SNACKS.map((snack) => ({
  id: `eat-${snack.id}`,
  nameZh: `想吃${snack.nameZh}`,
  nameEn: `Eat ${snack.nameEn}`,
  target: 1,
  action: { type: "feed" as const, foodId: snack.id as SnackId },
  weight: 30 / SNACKS.length,
  kind: "snack" as const,
}));

/**
 * Builds a 100-point weighted pool. With no toys, the missing 10-point toy
 * category is folded into the petting wish as the gentle fallback from the spec.
 */
export function getEligibleWishes(ownedToys: readonly ToyId[]): WishDefinition[] {
  const uniqueOwnedToys = [...new Set(ownedToys)].filter((toyId) =>
    TOYS.some((toy) => toy.id === toyId),
  );
  const fixed = FREE_WISHES.map((wish) =>
    wish.id === "pet-five" && uniqueOwnedToys.length === 0
      ? { ...wish, weight: wish.weight + 10 }
      : { ...wish },
  );
  const toyWeight = uniqueOwnedToys.length === 0 ? 0 : 10 / uniqueOwnedToys.length;
  return [
    ...fixed,
    ...uniqueOwnedToys.map((toyId) => makeToyWish(toyId, toyWeight)),
    ...SNACK_WISHES.map((wish) => ({ ...wish })),
  ];
}

export function findWishDefinition(
  wishId: string,
  ownedToys: readonly ToyId[] = TOYS.map((toy) => toy.id),
): WishDefinition | undefined {
  return getEligibleWishes(ownedToys).find((wish) => wish.id === wishId);
}
