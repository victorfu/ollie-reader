import { todayLocal } from "../../../../services/economyService";
import {
  CLEAN_BOND_THRESHOLD,
  DAILY_BOND_CAP,
  FREE_FOOD_DAILY_STOCK,
  FULLNESS_REFUSAL_THRESHOLD,
  INITIAL_STATS,
  SLEEP_BOND_REWARD,
  SLEEP_END_HOUR,
  SLEEP_START_HOUR,
  STAT_DECAY,
  STAT_MAX,
} from "../constants";
import { getFood, isFoodId, isFreeFoodId, isSnackId } from "../data/foods";
import { getOutfit, isOutfitId } from "../data/outfits";
import {
  getFurniture,
  isFloorId,
  isFurnitureId,
  isWallpaperId,
} from "../data/furniture";
import { getToy, isToyId } from "../data/toys";
import {
  type FoodId,
  type LocalDate,
  type PetSaveV1,
  type PetStats,
  type PlacedFurniture,
  type SnackId,
  type ToyId,
  type WishAction,
} from "../types";
import { applyMissedVisitBonus, awardBond } from "./bond";
import {
  backfillEarnedBondGifts,
  type BondGift,
} from "./personalization";
import { consumeSnack } from "./purchases";
import { clampPlacement } from "./roomLayout";
import { applyWishAction, refreshDailyWish } from "./wish";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type CareActionFailure =
  | "full"
  | "out-of-stock"
  | "toy-not-owned"
  | "outside-sleep-window"
  | "already-slept"
  | "already-awake";

export type CareActionResult = {
  save: PetSaveV1;
  applied: boolean;
  bondAwarded: number;
  capReached: boolean;
  phraseId?: string;
  reason?: CareActionFailure;
  grantedGifts: BondGift[];
};

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validLocalDate(value: unknown, fallback: LocalDate): LocalDate {
  return typeof value === "string" && LOCAL_DATE_PATTERN.test(value)
    ? value
    : fallback;
}

function uniqueValidIds<T extends string>(
  value: unknown,
  isValid: (candidate: unknown) => candidate is T,
): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isValid))];
}

export function createInitialPetSave(
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): PetSaveV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    clientUpdatedAt: now,
    stats: { ...INITIAL_STATS, statsAt: now },
    bond: { total: 0, earnedToday: 0, earnedDate: localDate },
    lastVisitAt: now,
    lastSleepDate: "",
    sleepingUntil: null,
    freeFood: {
      milk: FREE_FOOD_DAILY_STOCK,
      cookie: FREE_FOOD_DAILY_STOCK,
      restockDate: localDate,
    },
    inventory: {
      snacks: {},
      toys: [],
      outfits: [],
      furniture: ["cloud-bed"],
      wallpapers: ["cloud-blue"],
      floors: ["cream-wood"],
    },
    equipped: {},
    room: {
      wallpaperId: "cloud-blue",
      floorId: "cream-wood",
      placed: [
        { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
      ],
    },
    wish: {
      date: "",
      wishId: "",
      fulfilled: false,
      progress: 0,
      target: 1,
    },
  };
}

/**
 * Backfills old, partial, or malformed documents into the complete cache-safe
 * schema. It never carries Firestore Timestamp objects into the returned value.
 */
export function normalizePetSave(
  raw: unknown,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): PetSaveV1 {
  const defaults = createInitialPetSave(now, localDate);
  const root = recordOf(raw);
  const rawStats = recordOf(root.stats);
  const rawBond = recordOf(root.bond);
  const rawFreeFood = recordOf(root.freeFood);
  const rawInventory = recordOf(root.inventory);
  const rawSnacks = recordOf(rawInventory.snacks);
  const rawEquipped = recordOf(root.equipped);
  const rawRoom = recordOf(root.room);
  const rawWish = recordOf(root.wish);

  const snacks: Partial<Record<SnackId, number>> = {};
  for (const [key, value] of Object.entries(rawSnacks)) {
    if (!isSnackId(key)) continue;
    const count = nonNegativeInteger(value);
    if (count > 0) snacks[key] = count;
  }

  const bondTotal = nonNegativeInteger(rawBond.total);
  const outfits = uniqueValidIds(rawInventory.outfits, isOutfitId);
  const furniture = uniqueValidIds(rawInventory.furniture, isFurnitureId);
  if (!furniture.includes("cloud-bed")) furniture.unshift("cloud-bed");
  const wallpapers = uniqueValidIds(rawInventory.wallpapers, isWallpaperId);
  if (!wallpapers.includes("cloud-blue")) wallpapers.unshift("cloud-blue");
  const floors = uniqueValidIds(rawInventory.floors, isFloorId);
  if (!floors.includes("cream-wood")) floors.unshift("cream-wood");

  let placed: PlacedFurniture[] = defaults.room.placed;
  if (Array.isArray(rawRoom.placed)) {
    const placedById = new Map<PlacedFurniture["id"], PlacedFurniture>();
    for (const candidate of rawRoom.placed) {
      const item = recordOf(candidate);
      const definition = getFurniture(
        typeof item.id === "string" ? item.id : "",
      );
      // Clamping on load repairs saves written before placement accounted for
      // sprite size — most visibly a cloud bed stored near the floor limit,
      // which rendered with its bottom half cut off.
      const placement =
        definition && typeof item.x === "number" && typeof item.y === "number"
          ? clampPlacement(definition.id, item.x, item.y)
          : null;
      if (
        !definition ||
        !furniture.includes(definition.id) ||
        (item.zone !== "floor" && item.zone !== "wall") ||
        placement === null
      ) {
        continue;
      }
      // The last valid entry is the latest placement and therefore the z-order.
      placedById.delete(definition.id);
      placedById.set(definition.id, placement);
    }
    placed = [...placedById.values()];
  }

  const wishTarget = Math.max(1, nonNegativeInteger(rawWish.target, 1));
  const wishProgress = Math.min(
    wishTarget,
    nonNegativeInteger(rawWish.progress),
  );
  const rawSleepingUntil = finiteNumber(root.sleepingUntil, 0);
  const sleepingUntil = rawSleepingUntil > now ? rawSleepingUntil : null;
  const headDefinition = getOutfit(
    typeof rawEquipped.head === "string" ? rawEquipped.head : "",
  );
  const neckDefinition = getOutfit(
    typeof rawEquipped.neck === "string" ? rawEquipped.neck : "",
  );
  const head =
    headDefinition?.slot === "head" && outfits.includes(headDefinition.id)
      ? headDefinition.id
      : undefined;
  const neck =
    neckDefinition?.slot === "neck" && outfits.includes(neckDefinition.id)
      ? neckDefinition.id
      : undefined;
  const wallpaperId =
    isWallpaperId(rawRoom.wallpaperId) && wallpapers.includes(rawRoom.wallpaperId)
    ? rawRoom.wallpaperId
    : defaults.room.wallpaperId;
  const floorId =
    isFloorId(rawRoom.floorId) && floors.includes(rawRoom.floorId)
    ? rawRoom.floorId
    : defaults.room.floorId;

  return {
    schemaVersion: 1,
    revision: nonNegativeInteger(root.revision),
    // Missing on legacy cloud documents means "older than any optimistic edit".
    clientUpdatedAt: nonNegativeInteger(root.clientUpdatedAt),
    stats: {
      fullness: clamp(
        finiteNumber(rawStats.fullness, defaults.stats.fullness),
        STAT_DECAY.fullness.floor,
        STAT_MAX,
      ),
      clean: clamp(
        finiteNumber(rawStats.clean, defaults.stats.clean),
        STAT_DECAY.clean.floor,
        STAT_MAX,
      ),
      mood: clamp(
        finiteNumber(rawStats.mood, defaults.stats.mood),
        STAT_DECAY.mood.floor,
        STAT_MAX,
      ),
      statsAt: nonNegativeInteger(rawStats.statsAt, now),
    },
    bond: {
      total: bondTotal,
      earnedToday: Math.min(
        DAILY_BOND_CAP,
        nonNegativeInteger(rawBond.total),
        nonNegativeInteger(rawBond.earnedToday),
      ),
      earnedDate: validLocalDate(rawBond.earnedDate, localDate),
    },
    lastVisitAt: nonNegativeInteger(root.lastVisitAt, now),
    lastSleepDate: validLocalDate(root.lastSleepDate, ""),
    sleepingUntil,
    freeFood: {
      milk: nonNegativeInteger(rawFreeFood.milk, FREE_FOOD_DAILY_STOCK),
      cookie: nonNegativeInteger(rawFreeFood.cookie, FREE_FOOD_DAILY_STOCK),
      restockDate: validLocalDate(rawFreeFood.restockDate, localDate),
    },
    inventory: {
      snacks,
      toys: uniqueValidIds(rawInventory.toys, isToyId),
      outfits,
      furniture,
      wallpapers,
      floors,
    },
    equipped: {
      ...(head ? { head } : {}),
      ...(neck ? { neck } : {}),
    },
    room: { wallpaperId, floorId, placed },
    wish: {
      date: validLocalDate(rawWish.date, ""),
      wishId: typeof rawWish.wishId === "string" ? rawWish.wishId : "",
      progress: wishProgress,
      target: wishTarget,
      fulfilled: rawWish.fulfilled === true || wishProgress >= wishTarget,
    },
  };
}

/** Positive means a is fresher than b; revision wins, timestamp breaks ties. */
export function comparePetSaveFreshness(a: PetSaveV1, b: PetSaveV1): number {
  if (a.revision !== b.revision) return a.revision > b.revision ? 1 : -1;
  if (a.clientUpdatedAt === b.clientUpdatedAt) return 0;
  return a.clientUpdatedAt > b.clientUpdatedAt ? 1 : -1;
}

export function isPetSaveNewer(
  candidate: PetSaveV1,
  current: PetSaveV1,
): boolean {
  return comparePetSaveFreshness(candidate, current) > 0;
}

export function touchPetSave(save: PetSaveV1, now: number = Date.now()): PetSaveV1 {
  return {
    ...save,
    revision: Math.max(0, Math.floor(save.revision)) + 1,
    clientUpdatedAt: now,
  };
}

function decay(
  snapshot: number,
  elapsedMs: number,
  rule: (typeof STAT_DECAY)[keyof typeof STAT_DECAY],
): number {
  const pointsLost = (rule.points * elapsedMs) / rule.durationMs;
  return clamp(snapshot - pointsLost, rule.floor, STAT_MAX);
}

export function deriveStats(
  source: PetSaveV1 | PetStats,
  now: number = Date.now(),
): PetStats {
  const stats = "stats" in source ? source.stats : source;
  const snapshotAt = Math.max(now, stats.statsAt);
  const elapsedMs = snapshotAt - stats.statsAt;
  return {
    fullness: decay(stats.fullness, elapsedMs, STAT_DECAY.fullness),
    clean: decay(stats.clean, elapsedMs, STAT_DECAY.clean),
    mood: decay(stats.mood, elapsedMs, STAT_DECAY.mood),
    statsAt: snapshotAt,
  };
}

/** Tops each free item up to two. A future restock date is left untouched. */
export function restockFreeFood(
  save: PetSaveV1,
  localDate: LocalDate,
  now: number = Date.now(),
): PetSaveV1 {
  if (
    save.freeFood.restockDate === localDate ||
    save.freeFood.restockDate > localDate
  ) {
    return save;
  }
  return touchPetSave(
    {
      ...save,
      freeFood: {
        milk: Math.max(save.freeFood.milk, FREE_FOOD_DAILY_STOCK),
        cookie: Math.max(save.freeFood.cookie, FREE_FOOD_DAILY_STOCK),
        restockDate: localDate,
      },
    },
    now,
  );
}

function finishCare(
  save: PetSaveV1,
  stats: PetStats,
  bondGain: number,
  localDate: LocalDate,
  now: number,
  phraseId?: string,
  alreadyTouched = false,
): CareActionResult {
  const bondResult = awardBond(save.bond, bondGain, localDate);
  const patched = { ...save, stats, bond: bondResult.bond };
  const gifts = backfillEarnedBondGifts(patched);
  return {
    save: alreadyTouched ? gifts.save : touchPetSave(gifts.save, now),
    applied: true,
    bondAwarded: bondResult.awarded,
    capReached: bondResult.capReached,
    grantedGifts: gifts.granted,
    ...(phraseId ? { phraseId } : {}),
  };
}

export function feedPet(
  original: PetSaveV1,
  foodId: FoodId,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareActionResult {
  const food = getFood(foodId);
  if (!food || !isFoodId(foodId)) {
    return {
      save: original,
      applied: false,
      bondAwarded: 0,
      capReached: false,
      reason: "out-of-stock",
      grantedGifts: [],
    };
  }
  const restocked = restockFreeFood(original, localDate, now);
  const stats = deriveStats(restocked, now);
  if (stats.fullness >= FULLNESS_REFUSAL_THRESHOLD) {
    return {
      save: restocked,
      applied: false,
      bondAwarded: 0,
      capReached: restocked.bond.earnedToday >= DAILY_BOND_CAP,
      reason: "full",
      phraseId: "full",
      grantedGifts: [],
    };
  }

  let consumedSave = restocked;
  let alreadyTouched = restocked !== original;
  if (isFreeFoodId(foodId)) {
    if (restocked.freeFood[foodId] <= 0) {
      return {
        save: restocked,
        applied: false,
        bondAwarded: 0,
        capReached: restocked.bond.earnedToday >= DAILY_BOND_CAP,
        reason: "out-of-stock",
        grantedGifts: [],
      };
    }
    consumedSave = {
      ...restocked,
      freeFood: {
        ...restocked.freeFood,
        [foodId]: restocked.freeFood[foodId] - 1,
      },
    };
  } else {
    const consumed = consumeSnack(restocked, foodId, now);
    if (!consumed.ok) {
      return {
        save: restocked,
        applied: false,
        bondAwarded: 0,
        capReached: restocked.bond.earnedToday >= DAILY_BOND_CAP,
        reason: "out-of-stock",
        grantedGifts: [],
      };
    }
    consumedSave = consumed.save;
    alreadyTouched = true;
  }

  return finishCare(
    consumedSave,
    {
      fullness: Math.min(STAT_MAX, stats.fullness + food.fullnessGain),
      clean: stats.clean,
      mood: Math.min(STAT_MAX, stats.mood + food.moodGain),
      statsAt: stats.statsAt,
    },
    food.bondGain,
    localDate,
    now,
    food.kind === "snack" ? "love-it" : "yummy",
    alreadyTouched,
  );
}

export function bathePet(
  save: PetSaveV1,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareActionResult {
  const stats = deriveStats(save, now);
  const earnsBond = stats.clean < CLEAN_BOND_THRESHOLD;
  return finishCare(
    save,
    { ...stats, clean: STAT_MAX },
    earnsBond ? 6 : 0,
    localDate,
    now,
    "bubbles",
  );
}

export function petPet(
  save: PetSaveV1,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareActionResult {
  const stats = deriveStats(save, now);
  return finishCare(
    save,
    { ...stats, mood: Math.min(STAT_MAX, stats.mood + 5) },
    2,
    localDate,
    now,
  );
}

/** Alias that reads more naturally in event handlers. */
export const strokePet = petPet;

export function playWithToy(
  save: PetSaveV1,
  toyId: ToyId,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareActionResult {
  const toy = getToy(toyId);
  if (!toy || !save.inventory.toys.includes(toyId)) {
    return {
      save,
      applied: false,
      bondAwarded: 0,
      capReached: save.bond.earnedToday >= DAILY_BOND_CAP,
      reason: "toy-not-owned",
      grantedGifts: [],
    };
  }
  const stats = deriveStats(save, now);
  return finishCare(
    save,
    { ...stats, mood: Math.min(STAT_MAX, stats.mood + toy.moodGain) },
    toy.bondGain,
    localDate,
    now,
    "lets-play",
  );
}

export function isSleepWindow(date: Date): boolean {
  const hour = date.getHours();
  return hour >= SLEEP_START_HOUR || hour < SLEEP_END_HOUR;
}

/** A 01:00 sleep belongs to the previous evening's session. */
export function getSleepSessionDate(date: Date): LocalDate {
  const sessionDate = new Date(date);
  if (date.getHours() < SLEEP_END_HOUR) {
    sessionDate.setDate(sessionDate.getDate() - 1);
  }
  return todayLocal(sessionDate);
}

export function getNextWakeAt(date: Date): number {
  const wake = new Date(date);
  wake.setHours(SLEEP_END_HOUR, 0, 0, 0);
  if (date.getHours() >= SLEEP_START_HOUR) wake.setDate(wake.getDate() + 1);
  return wake.getTime();
}

export function isSleeping(save: PetSaveV1, now: number = Date.now()): boolean {
  return save.sleepingUntil !== null && save.sleepingUntil > now;
}

export function putPetToSleep(
  save: PetSaveV1,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareActionResult {
  const date = new Date(now);
  if (!isSleepWindow(date)) {
    return {
      save,
      applied: false,
      bondAwarded: 0,
      capReached: save.bond.earnedToday >= DAILY_BOND_CAP,
      reason: "outside-sleep-window",
      grantedGifts: [],
    };
  }
  const sessionDate = getSleepSessionDate(date);
  if (save.lastSleepDate === sessionDate) {
    return {
      save,
      applied: false,
      bondAwarded: 0,
      capReached: save.bond.earnedToday >= DAILY_BOND_CAP,
      reason: "already-slept",
      grantedGifts: [],
    };
  }
  const bondResult = awardBond(save.bond, SLEEP_BOND_REWARD, localDate);
  const gifts = backfillEarnedBondGifts({
    ...save,
    bond: bondResult.bond,
    lastSleepDate: sessionDate,
    sleepingUntil: getNextWakeAt(date),
  });
  return {
    save: touchPetSave(gifts.save, now),
    applied: true,
    bondAwarded: bondResult.awarded,
    capReached: bondResult.capReached,
    phraseId: "good-night",
    grantedGifts: gifts.granted,
  };
}

export function wakePet(
  save: PetSaveV1,
  now: number = Date.now(),
): CareActionResult {
  if (save.sleepingUntil === null) {
    return {
      save,
      applied: false,
      bondAwarded: 0,
      capReached: save.bond.earnedToday >= DAILY_BOND_CAP,
      reason: "already-awake",
      grantedGifts: [],
    };
  }
  return {
    save: touchPetSave({ ...save, sleepingUntil: null }, now),
    applied: true,
    bondAwarded: 0,
    capReached: save.bond.earnedToday >= DAILY_BOND_CAP,
    grantedGifts: [],
  };
}

export type VisitResult = {
  save: PetSaveV1;
  missed: boolean;
  bondAwarded: number;
  capReached: boolean;
  grantedGifts: BondGift[];
};

export function recordVisit(
  save: PetSaveV1,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): VisitResult {
  const result = applyMissedVisitBonus(
    save.bond,
    save.lastVisitAt,
    now,
    localDate,
  );
  const gifts = backfillEarnedBondGifts({
    ...save,
    bond: result.bond,
    lastVisitAt: result.lastVisitAt,
    sleepingUntil:
      save.sleepingUntil !== null && save.sleepingUntil <= now
        ? null
        : save.sleepingUntil,
  });
  return {
    save: touchPetSave(gifts.save, now),
    missed: result.missed,
    bondAwarded: result.awarded,
    capReached: result.capReached,
    grantedGifts: gifts.granted,
  };
}

/**
 * Canonical entry transition: refreshes daily stock and wish, records the visit,
 * and grants the welcome-back bonus at most once because lastVisitAt advances in
 * the same immutable result.
 */
export function preparePetVisit(
  save: PetSaveV1,
  uid: string,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): VisitResult {
  const stocked = restockFreeFood(save, localDate, now);
  const wish = refreshDailyWish(
    stocked.wish,
    uid,
    localDate,
    stocked.inventory.toys,
  );
  return recordVisit({ ...stocked, wish }, now, localDate);
}

export type CareWithWishResult = CareActionResult & {
  totalBondAwarded: number;
  wishBondAwarded: number;
  wishProgressed: boolean;
  newlyFulfilled: boolean;
};

/**
 * Complete Phase 1 interaction transition. A wish advances only after its care
 * action succeeds, and its +10 reward goes through the same partial daily cap.
 * The current day's seeded wish is refreshed before every action, which also
 * makes an interaction after midnight safe without a separate page reload.
 */
export function applyCareActionWithWish(
  original: PetSaveV1,
  uid: string,
  action: WishAction,
  now: number = Date.now(),
  localDate: LocalDate = todayLocal(new Date(now)),
): CareWithWishResult {
  const refreshedWish = refreshDailyWish(
    original.wish,
    uid,
    localDate,
    original.inventory.toys,
  );
  const wishWasRefreshed = refreshedWish !== original.wish;
  const save = wishWasRefreshed ? { ...original, wish: refreshedWish } : original;
  let care: CareActionResult;

  switch (action.type) {
    case "pet":
      care = petPet(save, now, localDate);
      break;
    case "bath":
      care = bathePet(save, now, localDate);
      break;
    case "feed":
      care = feedPet(save, action.foodId, now, localDate);
      break;
    case "play":
      care = playWithToy(save, action.toyId, now, localDate);
      break;
    case "sleep":
      care = putPetToSleep(save, now, localDate);
      break;
  }

  if (!care.applied) {
    const mustTouchWish = wishWasRefreshed && care.save === save;
    return {
      ...care,
      save: mustTouchWish ? touchPetSave(care.save, now) : care.save,
      totalBondAwarded: care.bondAwarded,
      wishBondAwarded: 0,
      wishProgressed: false,
      newlyFulfilled: false,
    };
  }

  const wishResult = applyWishAction(care.save.wish, action);
  if (!wishResult.progressed) {
    return {
      ...care,
      totalBondAwarded: care.bondAwarded,
      wishBondAwarded: 0,
      wishProgressed: false,
      newlyFulfilled: false,
    };
  }

  const wishBond = awardBond(care.save.bond, wishResult.bondReward, localDate);
  const wishGifts = backfillEarnedBondGifts({
    ...care.save,
    bond: wishBond.bond,
    wish: wishResult.wish,
  });
  return {
    ...care,
    save: wishGifts.save,
    bondAwarded: care.bondAwarded + wishBond.awarded,
    capReached: wishBond.capReached,
    totalBondAwarded: care.bondAwarded + wishBond.awarded,
    wishBondAwarded: wishBond.awarded,
    wishProgressed: true,
    newlyFulfilled: wishResult.newlyFulfilled,
    grantedGifts: [...care.grantedGifts, ...wishGifts.granted],
  };
}
