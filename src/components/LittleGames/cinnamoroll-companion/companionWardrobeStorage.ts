import type { CompanionAccessory, CompanionOutfit, CompanionSlot, CompanionWardrobe } from "../../../types/companion";
import { ACCESSORIES, COMPANION_PRICES, accessorySlot, isCompanionAccessory } from "./logic/outfit";

/**
 * Bought accessories live beside the gacha save, under the shared token
 * balance's document. This is deliberately not the retired `cloudCottage`
 * save, which is never read, written or deleted here.
 */
export const COMPANION_WARDROBE_DOC = "companionWardrobe";
export const COMPANION_INSUFFICIENT_COINS = "COMPANION_INSUFFICIENT_COINS";
export const COMPANION_ALREADY_OWNED = "COMPANION_ALREADY_OWNED";

export const EMPTY_WARDROBE: CompanionWardrobe = { owned: new Set(), equipped: {} };

export class CompanionInsufficientCoinsError extends Error {
  readonly code = COMPANION_INSUFFICIENT_COINS;
  readonly requiredCoins: number;
  readonly availableCoins: number;

  constructor(requiredCoins: number, availableCoins: number) {
    super(`Not enough coins for this accessory (need ${requiredCoins}, have ${availableCoins}).`);
    this.name = "CompanionInsufficientCoinsError";
    this.requiredCoins = requiredCoins;
    this.availableCoins = availableCoins;
  }
}

export class CompanionAlreadyOwnedError extends Error {
  readonly code = COMPANION_ALREADY_OWNED;
  readonly item: CompanionAccessory;

  constructor(item: CompanionAccessory) {
    super(`The ${item} accessory is already owned.`);
    this.name = "CompanionAlreadyOwnedError";
    this.item = item;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

export function isCompanionInsufficientCoinsError(error: unknown): error is CompanionInsufficientCoinsError {
  return error instanceof CompanionInsufficientCoinsError || hasCode(error, COMPANION_INSUFFICIENT_COINS);
}

export function isCompanionAlreadyOwnedError(error: unknown): error is CompanionAlreadyOwnedError {
  return error instanceof CompanionAlreadyOwnedError || hasCode(error, COMPANION_ALREADY_OWNED);
}

function assertUid(uid: string): void {
  if (uid.trim().length === 0) {
    throw new Error("A signed-in user id is required for the companion wardrobe.");
  }
}

function assertPurchaseId(purchaseId: string): void {
  if (purchaseId.trim().length === 0 || purchaseId.length > 200) {
    throw new Error("A valid companion purchase id is required.");
  }
}

/** One id per purchase attempt; a retry reuses it so a lost reply never charges twice. */
export function createPurchaseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** 與扭蛋機相同：缺欄位或壞資料一律視為 0 代幣 */
function parseCoins(data: unknown): number {
  if (!isRecord(data)) return 0;
  const coins = data.coins;
  if (typeof coins !== "number" || !Number.isFinite(coins)) return 0;
  const normalized = Math.floor(coins);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function ownedEntries(data: unknown): Record<string, unknown> {
  return isRecord(data) && isRecord(data.owned) ? data.owned : {};
}

/** Drops unknown accessories, and equipment that is not owned or sits in the wrong slot. */
export function normalizeWardrobe(data: unknown): CompanionWardrobe {
  const owned = new Set(Object.keys(ownedEntries(data)).filter(isCompanionAccessory));
  const equipped: CompanionOutfit = {};
  const rawEquipped = isRecord(data) && isRecord(data.equipped) ? data.equipped : {};
  for (const { slot } of ACCESSORIES) {
    const id = rawEquipped[slot];
    if (isCompanionAccessory(id) && owned.has(id) && accessorySlot(id) === slot) equipped[slot] = id;
  }
  return { owned, equipped };
}

async function firestore() {
  const [firestoreModule, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  return { ...firestoreModule, db };
}

/** Watches the wardrobe so purchases from another tab or device show up. */
export async function subscribeCompanionWardrobe(
  uid: string,
  onWardrobe: (wardrobe: CompanionWardrobe) => void,
  onError: (error: Error) => void,
): Promise<() => void> {
  assertUid(uid);
  const { doc, onSnapshot, db } = await firestore();
  return onSnapshot(
    doc(db, "gameProgress", uid, "littleGames", COMPANION_WARDROBE_DOC),
    (snapshot) => onWardrobe(snapshot.exists() ? normalizeWardrobe(snapshot.data()) : EMPTY_WARDROBE),
    onError,
  );
}

export interface CompanionPurchaseResult {
  wardrobe: CompanionWardrobe;
  coinsAfter: number;
  /** The same purchase id had already been charged; nothing was charged now. */
  replayed: boolean;
}

/**
 * Buys an accessory and puts it on. The token deduction, the ownership grant
 * and the equipment change are one Firestore transaction: either all of them
 * happen or none does. The price always comes from `COMPANION_PRICES`, never
 * from the caller. Reusing `purchaseId` after an uncertain failure returns
 * the earlier purchase instead of charging again.
 */
export async function purchaseCompanionAccessory(
  uid: string,
  item: CompanionAccessory,
  purchaseId: string,
): Promise<CompanionPurchaseResult> {
  assertUid(uid);
  assertPurchaseId(purchaseId);
  if (!isCompanionAccessory(item)) throw new Error(`Unknown companion accessory: ${String(item)}`);
  const price = COMPANION_PRICES[item];

  const { doc, runTransaction, serverTimestamp, db } = await firestore();
  const ref = doc(db, "gameProgress", uid, "littleGames", COMPANION_WARDROBE_DOC);
  const progressRef = doc(db, "gameProgress", uid);

  return runTransaction(db, async (transaction) => {
    const [snapshot, progressSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(progressRef),
    ]);
    const rawData = snapshot.exists() ? snapshot.data() : null;
    const current = normalizeWardrobe(rawData);
    const availableCoins = progressSnapshot.exists() ? parseCoins(progressSnapshot.data()) : 0;

    const existing = ownedEntries(rawData)[item];
    if (current.owned.has(item)) {
      if (isRecord(existing) && existing.purchaseId === purchaseId) {
        return { wardrobe: current, coinsAfter: availableCoins, replayed: true };
      }
      throw new CompanionAlreadyOwnedError(item);
    }
    if (availableCoins < price) {
      throw new CompanionInsufficientCoinsError(price, availableCoins);
    }

    const coinsAfter = availableCoins - price;
    const slot: CompanionSlot = accessorySlot(item);
    const equipped: CompanionOutfit = { ...current.equipped, [slot]: item };
    const timestamp = serverTimestamp();
    const writeData: Record<string, unknown> = {
      schemaVersion: 1,
      owned: { [item]: { price, purchaseId, purchasedAt: timestamp } },
      equipped,
      updatedAt: timestamp,
    };
    if (!snapshot.exists()) writeData.createdAt = timestamp;
    // merge keeps the other owned entries; `equipped` is written whole.
    transaction.set(ref, writeData, { merge: true });
    transaction.update(progressRef, { coins: coinsAfter, updatedAt: timestamp });

    return {
      wardrobe: { owned: new Set([...current.owned, item]), equipped },
      coinsAfter,
      replayed: false,
    };
  });
}

/**
 * Saves what the companion wears. Only owned accessories are kept, so a
 * try-on can never be saved as equipment. The document must already exist,
 * which it does once anything was bought.
 */
export async function saveCompanionEquipment(
  uid: string,
  outfit: CompanionOutfit,
  owned: ReadonlySet<CompanionAccessory>,
): Promise<void> {
  assertUid(uid);
  const equipped: CompanionOutfit = {};
  for (const [slot, id] of Object.entries(outfit) as [CompanionSlot, CompanionAccessory][]) {
    if (owned.has(id) && accessorySlot(id) === slot) equipped[slot] = id;
  }
  const { doc, updateDoc, serverTimestamp, db } = await firestore();
  await updateDoc(doc(db, "gameProgress", uid, "littleGames", COMPANION_WARDROBE_DOC), {
    equipped,
    updatedAt: serverTimestamp(),
  });
}
