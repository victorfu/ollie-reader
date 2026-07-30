import { todayLocal } from "../../../services/economyService";
import type {
  CottageProduct,
  CottageProductId,
  PetSaveV1,
  WishAction,
} from "./types";
import {
  applyCareActionWithWish,
  comparePetSaveFreshness,
  createInitialPetSave,
  normalizePetSave,
  type CareWithWishResult,
} from "./logic/petState";
import { applyPurchase, getProduct } from "./logic/purchases";
import {
  applyPersonalizationAction,
  grantEarnedBondGifts,
  type BondGift,
  type PersonalizationAction,
  type PersonalizationResult,
} from "./logic/personalization";

export const COTTAGE_CACHE_PREFIX = "ollie-cloud-cottage-cache-v1:";
export const COTTAGE_CLOUD_DOC = "cloudCottage";
export const COTTAGE_INSUFFICIENT_COINS =
  "COTTAGE_INSUFFICIENT_COINS";
export const COTTAGE_ALREADY_OWNED = "COTTAGE_ALREADY_OWNED";

export type CottageCacheStorage = Pick<Storage, "getItem" | "setItem">;
export type CottageCacheLockManager = {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
};

export type CommittedCottagePurchase = {
  save: PetSaveV1;
  coinsAfter: number;
  product: CottageProduct;
};

export type CommittedCottageCareAction = CareWithWishResult & {
  grantedGifts: BondGift[];
};

export type CommittedCottagePersonalization = PersonalizationResult;

export type CommittedCottagePersonalizationActions = {
  save: PetSaveV1;
  applied: boolean;
  grantedGifts: BondGift[];
};

export class CottageInsufficientCoinsError extends Error {
  readonly code = COTTAGE_INSUFFICIENT_COINS;
  readonly requiredCoins: number;
  readonly availableCoins: number;

  constructor(requiredCoins: number, availableCoins: number) {
    super(
      `Not enough coins for this Cloud Cottage item (need ${requiredCoins}, have ${availableCoins}).`,
    );
    this.name = "CottageInsufficientCoinsError";
    this.requiredCoins = requiredCoins;
    this.availableCoins = availableCoins;
  }
}

export class CottageAlreadyOwnedError extends Error {
  readonly code = COTTAGE_ALREADY_OWNED;
  readonly productId: CottageProductId;

  constructor(productId: CottageProductId) {
    super(`This permanent Cloud Cottage item is already owned: ${productId}.`);
    this.name = "CottageAlreadyOwnedError";
    this.productId = productId;
  }
}

function defaultStorage(): CottageCacheStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultLockManager(): CottageCacheLockManager | null {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return null;
  return navigator.locks as CottageCacheLockManager;
}

function assertUid(uid: string): void {
  if (uid.trim().length === 0) {
    throw new Error("A signed-in user id is required for Cloud Cottage storage.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCoins(data: unknown): number {
  if (!isRecord(data)) return 0;
  const value = data.coins;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const coins = Math.floor(value);
  return Number.isSafeInteger(coins) && coins >= 0 ? coins : 0;
}

function unionOwnedIds<T extends string>(
  primary: readonly T[],
  secondary: readonly T[],
): T[] {
  return [...new Set([...primary, ...secondary])];
}

/**
 * Reconciles two independently valid snapshots without treating paid,
 * permanent ownership as last-write-wins data. Ordinary mutable state comes
 * from the fresher snapshot, while ownership is monotonic across both tabs.
 * A final normalization keeps equipped items and room selections/placements
 * constrained to the reconciled inventory and restores required defaults.
 */
export function reconcileCottageSaveSnapshots(
  left: PetSaveV1,
  right: PetSaveV1 | null,
  now: number = Date.now(),
  localDate: string = todayLocal(new Date(now)),
): PetSaveV1 {
  if (!right) return normalizePetSave(left, now, localDate);

  const [primary, secondary] =
    comparePetSaveFreshness(right, left) > 0
      ? [right, left]
      : [left, right];

  return normalizePetSave(
    {
      ...primary,
      inventory: {
        ...primary.inventory,
        toys: unionOwnedIds(
          primary.inventory.toys,
          secondary.inventory.toys,
        ),
        outfits: unionOwnedIds(
          primary.inventory.outfits,
          secondary.inventory.outfits,
        ),
        furniture: unionOwnedIds(
          primary.inventory.furniture,
          secondary.inventory.furniture,
        ),
        wallpapers: unionOwnedIds(
          primary.inventory.wallpapers,
          secondary.inventory.wallpapers,
        ),
        floors: unionOwnedIds(
          primary.inventory.floors,
          secondary.inventory.floors,
        ),
      },
    },
    now,
    localDate,
  );
}

function hasAdditionalPermanentOwnership(
  baseline: PetSaveV1,
  candidate: PetSaveV1,
): boolean {
  return (
    candidate.inventory.toys.some(
      (id) => !baseline.inventory.toys.includes(id),
    ) ||
    candidate.inventory.outfits.some(
      (id) => !baseline.inventory.outfits.includes(id),
    ) ||
    candidate.inventory.furniture.some(
      (id) => !baseline.inventory.furniture.includes(id),
    ) ||
    candidate.inventory.wallpapers.some(
      (id) => !baseline.inventory.wallpapers.includes(id),
    ) ||
    candidate.inventory.floors.some(
      (id) => !baseline.inventory.floors.includes(id),
    )
  );
}

function buildFirestoreEnvelope(
  save: PetSaveV1,
  raw: unknown,
  timestamp: unknown,
): Record<string, unknown> {
  return {
    ...save,
    createdAt:
      isRecord(raw) && raw.createdAt != null ? raw.createdAt : timestamp,
    updatedAt: timestamp,
  };
}

export function isCottageInsufficientCoinsError(
  error: unknown,
): error is CottageInsufficientCoinsError {
  return (
    error instanceof CottageInsufficientCoinsError ||
    (isRecord(error) && error.code === COTTAGE_INSUFFICIENT_COINS)
  );
}

export function isCottageAlreadyOwnedError(
  error: unknown,
): error is CottageAlreadyOwnedError {
  return (
    error instanceof CottageAlreadyOwnedError ||
    (isRecord(error) && error.code === COTTAGE_ALREADY_OWNED)
  );
}

export function getCottageCacheKey(uid: string): string {
  assertUid(uid);
  return `${COTTAGE_CACHE_PREFIX}${uid}`;
}

export function parseCottageCacheValue(
  raw: string | null,
  now: number = Date.now(),
): PetSaveV1 | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return null;
    return normalizePetSave(parsed, now, todayLocal(new Date(now)));
  } catch {
    return null;
  }
}

export function compareCottageSaveVersions(
  left: PetSaveV1,
  right: PetSaveV1,
): number {
  return comparePetSaveFreshness(left, right);
}

/** Compatibility name used by the game UI and storage-event handler. */
export const comparePetSaveVersions = compareCottageSaveVersions;

export function readCottageCache(
  uid: string,
  storage: CottageCacheStorage | null = defaultStorage(),
  now: number = Date.now(),
): PetSaveV1 | null {
  if (!storage) return null;

  try {
    return parseCottageCacheValue(
      storage.getItem(getCottageCacheKey(uid)),
      now,
    );
  } catch {
    return null;
  }
}

function writeCottageCacheUnlocked(
  uid: string,
  save: PetSaveV1,
  storage: CottageCacheStorage | null,
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizePetSave(save);
    const current = readCottageCache(uid, storage);
    const reconciled = reconcileCottageSaveSnapshots(normalized, current);
    storage.setItem(getCottageCacheKey(uid), JSON.stringify(reconciled));
    return true;
  } catch {
    return false;
  }
}

export async function writeCottageCache(
  uid: string,
  save: PetSaveV1,
  storage: CottageCacheStorage | null = defaultStorage(),
  lockManager: CottageCacheLockManager | null = defaultLockManager(),
): Promise<boolean> {
  if (!storage) return false;

  if (lockManager) {
    try {
      return await lockManager.request(getCottageCacheKey(uid), () =>
        writeCottageCacheUnlocked(uid, save, storage),
      );
    } catch {
      // Some restricted browsers expose Web Locks but reject requests.
      // The freshness-checked fallback still prevents ordinary stale writes.
    }
  }

  return writeCottageCacheUnlocked(uid, save, storage);
}

export async function loadCottageCloud(
  uid: string,
  storage: CottageCacheStorage | null = defaultStorage(),
  now: number = Date.now(),
): Promise<PetSaveV1> {
  assertUid(uid);
  const [{ doc, getDocFromServer }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );
  const snapshot = await getDocFromServer(ref);
  const localDate = todayLocal(new Date(now));
  const cloud = snapshot.exists()
    ? normalizePetSave(snapshot.data(), now, localDate)
    : createInitialPetSave(now, localDate);

  await writeCottageCache(uid, cloud, storage);
  return readCottageCache(uid, storage, now) ?? cloud;
}

/**
 * Saves only if the candidate is at least as fresh as Firestore. The revision
 * guard prevents a slow optimistic write from erasing a later purchase.
 */
export async function saveCottageCloud(
  uid: string,
  save: PetSaveV1,
  storage: CottageCacheStorage | null = defaultStorage(),
  now: number = Date.now(),
): Promise<PetSaveV1> {
  assertUid(uid);
  const localDate = todayLocal(new Date(now));
  const candidate = normalizePetSave(save, now, localDate);
  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );

  const committed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.exists() ? snapshot.data() : null;
    const current = snapshot.exists()
      ? normalizePetSave(raw, now, localDate)
      : createInitialPetSave(now, localDate);

    const reconciled = reconcileCottageSaveSnapshots(
      current,
      candidate,
      now,
      localDate,
    );
    if (
      snapshot.exists() &&
      comparePetSaveFreshness(current, candidate) > 0 &&
      !hasAdditionalPermanentOwnership(current, reconciled)
    ) {
      return current;
    }

    const timestamp = serverTimestamp();
    const envelope = buildFirestoreEnvelope(reconciled, raw, timestamp);
    // This document is an owned canonical snapshot. Replacing it is required:
    // a merge would keep omitted nested snack keys and resurrect consumed food.
    transaction.set(ref, envelope);
    return reconciled;
  });

  await writeCottageCache(uid, committed, storage);
  return committed;
}

/** Reads the shared Word Adventure coin balance. Missing or dirty data is 0. */
export async function loadCottageCoins(uid: string): Promise<number> {
  assertUid(uid);
  const [{ doc, getDocFromServer }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid);
  const snapshot = await getDocFromServer(ref);
  return snapshot.exists() ? parseCoins(snapshot.data()) : 0;
}

/** Compatibility alias shared with the existing gacha-machine vocabulary. */
export const loadPlayerCoins = loadCottageCoins;

export async function purchaseCottageProduct(
  uid: string,
  productId: CottageProductId | string,
  storage: CottageCacheStorage | null = defaultStorage(),
  now: number = Date.now(),
): Promise<CommittedCottagePurchase> {
  assertUid(uid);
  const product = getProduct(productId);
  if (!product) {
    throw new Error(`Unknown Cloud Cottage product: ${productId}.`);
  }

  // Capture once: Firestore may retry the callback, but one click must keep the
  // same product, time, and optimistic base throughout every retry.
  const cachedCandidate = readCottageCache(uid, storage, now);
  const localDate = todayLocal(new Date(now));
  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );
  const progressRef = doc(db, "gameProgress", uid);

  const committed = await runTransaction(db, async (transaction) => {
    const [snapshot, progressSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(progressRef),
    ]);
    const raw = snapshot.exists() ? snapshot.data() : null;
    const cloud = snapshot.exists()
      ? normalizePetSave(raw, now, localDate)
      : createInitialPetSave(now, localDate);
    const current = reconcileCottageSaveSnapshots(
      cloud,
      cachedCandidate,
      now,
      localDate,
    );
    const gifts = grantEarnedBondGifts(current, now);
    const availableCoins = progressSnapshot.exists()
      ? parseCoins(progressSnapshot.data())
      : 0;
    const applied = applyPurchase(
      gifts.save,
      availableCoins,
      product.id,
      now,
    );

    if (!applied.ok) {
      if (applied.reason === "already-owned") {
        throw new CottageAlreadyOwnedError(product.id);
      }
      if (applied.reason === "insufficient-coins") {
        throw new CottageInsufficientCoinsError(
          product.price,
          availableCoins,
        );
      }
      throw new Error(`Cloud Cottage purchase failed: ${applied.reason}.`);
    }

    const timestamp = serverTimestamp();
    const envelope = buildFirestoreEnvelope(applied.save, raw, timestamp);
    transaction.set(ref, envelope);
    transaction.update(progressRef, {
      coins: applied.coinsAfter,
      updatedAt: timestamp,
    });

    return {
      save: applied.save,
      coinsAfter: applied.coinsAfter,
      product: applied.product,
    };
  });

  await writeCottageCache(uid, committed.save, storage);
  return committed;
}

/**
 * Commits the complete care transition in one transaction. This keeps snack
 * and free-food consumption, the daily bond cap, and wish rewards consistent
 * when the game is open in more than one tab.
 *
 * Optimistic animation state must stay inside React until this resolves. Do
 * not cache an already-applied optimistic result first, or this canonical
 * transition would correctly treat it as the base for a second action.
 */
export async function commitCottageCareAction(
  uid: string,
  action: WishAction,
  now: number = Date.now(),
  storage: CottageCacheStorage | null = defaultStorage(),
): Promise<CommittedCottageCareAction> {
  assertUid(uid);
  const cachedCandidate = readCottageCache(uid, storage, now);
  const localDate = todayLocal(new Date(now));
  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );

  const committed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.exists() ? snapshot.data() : null;
    const cloud = snapshot.exists()
      ? normalizePetSave(raw, now, localDate)
      : createInitialPetSave(now, localDate);
    const current = reconcileCottageSaveSnapshots(
      cloud,
      cachedCandidate,
      now,
      localDate,
    );
    const care = applyCareActionWithWish(
      current,
      uid,
      action,
      now,
      localDate,
    );
    const result: CommittedCottageCareAction = care;
    const shouldWrite =
      !snapshot.exists() ||
      comparePetSaveFreshness(result.save, cloud) > 0 ||
      hasAdditionalPermanentOwnership(cloud, result.save);

    if (shouldWrite) {
      const timestamp = serverTimestamp();
      const envelope = buildFirestoreEnvelope(result.save, raw, timestamp);
      transaction.set(ref, envelope);
    }

    return result;
  });

  await writeCottageCache(uid, committed.save, storage);
  return committed;
}

/**
 * Commits one idempotent, absolute personalization action against the freshest
 * cloud/cache snapshot. Full-document replacement is intentional: unequipping
 * an optional slot or removing a placement must delete the old nested value.
 */
export async function commitCottagePersonalizationAction(
  uid: string,
  action: PersonalizationAction,
  now: number = Date.now(),
  storage: CottageCacheStorage | null = defaultStorage(),
): Promise<CommittedCottagePersonalization> {
  assertUid(uid);
  const cachedCandidate = readCottageCache(uid, storage, now);
  const localDate = todayLocal(new Date(now));
  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );

  const committed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.exists() ? snapshot.data() : null;
    const cloud = snapshot.exists()
      ? normalizePetSave(raw, now, localDate)
      : createInitialPetSave(now, localDate);
    const current = reconcileCottageSaveSnapshots(
      cloud,
      cachedCandidate,
      now,
      localDate,
    );
    const personalization = applyPersonalizationAction(
      current,
      action,
      now,
    );
    const result: CommittedCottagePersonalization = personalization;

    const timestamp = serverTimestamp();
    const envelope = buildFirestoreEnvelope(result.save, raw, timestamp);
    transaction.set(ref, envelope);
    return result;
  });

  await writeCottageCache(uid, committed.save, storage);
  return committed;
}

function applyCottagePersonalizationActions(
  initial: PetSaveV1,
  actions: readonly PersonalizationAction[],
  now: number,
): CommittedCottagePersonalizationActions {
  let save = initial;
  let applied = false;
  const grantedGifts = new Map<string, BondGift>();

  for (const action of actions) {
    const result = applyPersonalizationAction(save, action, now);
    save = result.save;
    applied ||= result.applied;

    for (const gift of result.grantedGifts) {
      grantedGifts.set(`${gift.kind}:${gift.id}`, gift);
    }
  }

  return {
    save,
    applied,
    grantedGifts: [...grantedGifts.values()],
  };
}

/**
 * Applies an ordered personalization batch against one freshest snapshot and
 * persists the complete canonical result with one transaction write. Gift
 * notifications are returned once per unique gift in first-granted order.
 * `applied` is true when at least one action in the batch succeeds.
 *
 * An empty batch is a local no-op: it returns the cached save (or a new initial
 * save when no cache exists) without opening a Firestore transaction or
 * rewriting the cache.
 */
export async function commitCottagePersonalizationActions(
  uid: string,
  actions: readonly PersonalizationAction[],
  now: number = Date.now(),
  storage: CottageCacheStorage | null = defaultStorage(),
): Promise<CommittedCottagePersonalizationActions> {
  assertUid(uid);
  const cachedCandidate = readCottageCache(uid, storage, now);
  const localDate = todayLocal(new Date(now));

  if (actions.length === 0) {
    return {
      save: cachedCandidate ?? createInitialPetSave(now, localDate),
      applied: false,
      grantedGifts: [],
    };
  }

  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    COTTAGE_CLOUD_DOC,
  );

  const committed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.exists() ? snapshot.data() : null;
    const cloud = snapshot.exists()
      ? normalizePetSave(raw, now, localDate)
      : createInitialPetSave(now, localDate);
    const current = reconcileCottageSaveSnapshots(
      cloud,
      cachedCandidate,
      now,
      localDate,
    );
    const result = applyCottagePersonalizationActions(
      current,
      actions,
      now,
    );

    const timestamp = serverTimestamp();
    const envelope = buildFirestoreEnvelope(result.save, raw, timestamp);
    transaction.set(ref, envelope);
    return result;
  });

  await writeCottageCache(uid, committed.save, storage);
  return committed;
}

/** Short alias for callers that already name their value `action`. */
export const commitCottagePersonalization =
  commitCottagePersonalizationAction;
