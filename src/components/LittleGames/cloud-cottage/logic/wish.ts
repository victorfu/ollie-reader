import { WISH_BOND_REWARD } from "../constants";
import { findWishDefinition, getEligibleWishes } from "../data/wishes";
import type {
  LocalDate,
  PetWish,
  ToyId,
  WishAction,
  WishDefinition,
} from "../types";

/** Stable FNV-1a hash. Math.imul keeps its output identical in every browser. */
export function hashWishSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function selectDailyWish(
  uid: string,
  localDate: LocalDate,
  ownedToys: readonly ToyId[],
): WishDefinition {
  const pool = getEligibleWishes(ownedToys);
  const totalWeight = pool.reduce((total, wish) => total + wish.weight, 0);
  const unit = hashWishSeed(`${localDate}:${uid}`) / 0x1_0000_0000;
  let cursor = unit * totalWeight;

  for (const wish of pool) {
    cursor -= wish.weight;
    if (cursor < 0) return wish;
  }
  return pool[pool.length - 1];
}

export function createDailyWish(
  uid: string,
  localDate: LocalDate,
  ownedToys: readonly ToyId[],
): PetWish {
  const selected = selectDailyWish(uid, localDate, ownedToys);
  return {
    date: localDate,
    wishId: selected.id,
    fulfilled: false,
    progress: 0,
    target: selected.target,
  };
}

/** Keeps today's valid wish exactly as-is; only a new local date draws again. */
export function refreshDailyWish(
  current: PetWish,
  uid: string,
  localDate: LocalDate,
  ownedToys: readonly ToyId[],
): PetWish {
  const existing = findWishDefinition(current.wishId, ownedToys);
  if (
    current.date === localDate
    && current.wishId.startsWith("play-")
    && !existing
  ) {
    const fallback = findWishDefinition("pet-five", ownedToys);
    if (!fallback) throw new Error("Missing pet-five wish fallback");
    return {
      date: localDate,
      wishId: fallback.id,
      fulfilled: false,
      progress: 0,
      target: fallback.target,
    };
  }
  if (current.date !== localDate || !existing) {
    return createDailyWish(uid, localDate, ownedToys);
  }

  const target = Math.max(1, Math.floor(existing.target));
  const progress = Math.min(target, Math.max(0, Math.floor(current.progress)));
  const fulfilled = current.fulfilled || progress >= target;
  if (
    target === current.target &&
    progress === current.progress &&
    fulfilled === current.fulfilled
  ) {
    return current;
  }
  return { ...current, target, progress, fulfilled };
}

export function wishActionMatches(
  definition: WishDefinition,
  action: WishAction,
): boolean {
  if (definition.action.type !== action.type) return false;
  if (definition.action.type === "feed" && action.type === "feed") {
    return definition.action.foodId === action.foodId;
  }
  if (definition.action.type === "play" && action.type === "play") {
    return definition.action.toyId === action.toyId;
  }
  return true;
}

export type WishActionResult = {
  wish: PetWish;
  matched: boolean;
  progressed: boolean;
  newlyFulfilled: boolean;
  bondReward: number;
};

/**
 * Advances wish progress without touching bond. bondReward is emitted exactly
 * once, so the caller can pass it through the ordinary daily-cap award path.
 */
export function applyWishAction(
  current: PetWish,
  action: WishAction,
): WishActionResult {
  const definition = findWishDefinition(current.wishId);
  const matched = definition ? wishActionMatches(definition, action) : false;
  if (!definition || !matched || current.fulfilled) {
    return {
      wish: current,
      matched,
      progressed: false,
      newlyFulfilled: false,
      bondReward: 0,
    };
  }

  const target = Math.max(1, current.target || definition.target);
  const progress = Math.min(target, Math.max(0, current.progress) + 1);
  const newlyFulfilled = progress >= target;
  return {
    wish: {
      ...current,
      progress,
      target,
      fulfilled: newlyFulfilled,
    },
    matched: true,
    progressed: true,
    newlyFulfilled,
    bondReward: newlyFulfilled ? WISH_BOND_REWARD : 0,
  };
}

export function getWishDefinition(wish: PetWish): WishDefinition | undefined {
  return findWishDefinition(wish.wishId);
}
