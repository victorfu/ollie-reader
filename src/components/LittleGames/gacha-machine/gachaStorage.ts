import {
  GACHA_DRAW_COST,
  applyGachaAttempt,
  assertGachaOutcome,
  createEmptyGachaSave,
  normalizeGachaSave,
} from "./gachaLogic";
import type {
  CommittedGachaAttempt,
  GachaOutcome,
  GachaSaveV1,
} from "./gachaTypes";

export const GACHA_CACHE_PREFIX = "ollie-gacha-machine-cache-v1:";
export const GACHA_CLOUD_DOC = "gachaMachine";
export const GACHA_RESET_CONFLICT = "GACHA_RESET_CONFLICT";
export const GACHA_INSUFFICIENT_COINS = "GACHA_INSUFFICIENT_COINS";

export type GachaCacheStorage = Pick<Storage, "getItem" | "setItem">;
export type GachaCacheLockManager = {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
};

export class GachaResetConflictError extends Error {
  readonly code = GACHA_RESET_CONFLICT;
  readonly expectedResetVersion: number;
  readonly actualResetVersion: number;

  constructor(
    expectedResetVersion: number,
    actualResetVersion: number,
  ) {
    super(
      `Gacha collection was reset while drawing (expected version ${expectedResetVersion}, found ${actualResetVersion}).`,
    );
    this.name = "GachaResetConflictError";
    this.expectedResetVersion = expectedResetVersion;
    this.actualResetVersion = actualResetVersion;
  }
}

export class GachaInsufficientCoinsError extends Error {
  readonly code = GACHA_INSUFFICIENT_COINS;
  readonly requiredCoins: number;
  readonly availableCoins: number;

  constructor(requiredCoins: number, availableCoins: number) {
    super(
      `Not enough coins for a gacha draw (need ${requiredCoins}, have ${availableCoins}).`,
    );
    this.name = "GachaInsufficientCoinsError";
    this.requiredCoins = requiredCoins;
    this.availableCoins = availableCoins;
  }
}

function defaultStorage(): GachaCacheStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultLockManager(): GachaCacheLockManager | null {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return null;
  return navigator.locks as GachaCacheLockManager;
}

function assertUid(uid: string): void {
  if (uid.trim().length === 0) {
    throw new Error("A signed-in user id is required for gacha storage.");
  }
}

function assertResetVersion(resetVersion: number): void {
  if (!Number.isSafeInteger(resetVersion) || resetVersion < 0) {
    throw new Error("A non-negative reset version is required for gacha storage.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isGachaResetConflictError(
  error: unknown,
): error is GachaResetConflictError {
  return error instanceof GachaResetConflictError
    || (isRecord(error) && error.code === GACHA_RESET_CONFLICT);
}

export function isGachaInsufficientCoinsError(
  error: unknown,
): error is GachaInsufficientCoinsError {
  return error instanceof GachaInsufficientCoinsError
    || (isRecord(error) && error.code === GACHA_INSUFFICIENT_COINS);
}

/** 從 Firestore 舊版 coins 欄位讀出代幣餘額（缺欄位/壞資料一律視為 0） */
function parseCoins(data: unknown): number {
  if (!isRecord(data)) return 0;
  const coins = data.coins;
  if (typeof coins !== "number" || !Number.isFinite(coins)) return 0;
  const normalized = Math.floor(coins);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

export function getGachaCacheKey(uid: string): string {
  assertUid(uid);
  return `${GACHA_CACHE_PREFIX}${uid}`;
}

export function parseGachaCacheValue(raw: string | null): GachaSaveV1 | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return null;
    return normalizeGachaSave(parsed);
  } catch {
    return null;
  }
}

export function compareGachaSaveVersions(
  left: GachaSaveV1,
  right: GachaSaveV1,
): number {
  if (left.resetVersion !== right.resetVersion) {
    return left.resetVersion > right.resetVersion ? 1 : -1;
  }
  if (left.totalDraws !== right.totalDraws) {
    return left.totalDraws > right.totalDraws ? 1 : -1;
  }
  return 0;
}

export function readGachaCache(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): GachaSaveV1 | null {
  if (!storage) return null;

  try {
    return parseGachaCacheValue(storage.getItem(getGachaCacheKey(uid)));
  } catch {
    return null;
  }
}

function writeGachaCacheUnlocked(
  uid: string,
  save: GachaSaveV1,
  storage: GachaCacheStorage | null,
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizeGachaSave(save);
    const current = readGachaCache(uid, storage);
    if (current && compareGachaSaveVersions(current, normalized) > 0) {
      return true;
    }
    storage.setItem(
      getGachaCacheKey(uid),
      JSON.stringify(normalized),
    );
    return true;
  } catch {
    return false;
  }
}

export async function writeGachaCache(
  uid: string,
  save: GachaSaveV1,
  storage: GachaCacheStorage | null = defaultStorage(),
  lockManager: GachaCacheLockManager | null = defaultLockManager(),
): Promise<boolean> {
  if (!storage) return false;

  if (lockManager) {
    try {
      return await lockManager.request(getGachaCacheKey(uid), () =>
        writeGachaCacheUnlocked(uid, save, storage),
      );
    } catch {
      // Restricted contexts may expose Web Locks but reject lock requests.
      // Keep the freshness-checked fallback instead of losing the cache.
    }
  }

  return writeGachaCacheUnlocked(uid, save, storage);
}

export async function loadGachaCloud(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaSaveV1> {
  assertUid(uid);
  const [{ doc, getDocFromServer }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);
  const snapshot = await getDocFromServer(ref);
  const save = snapshot.exists()
    ? normalizeGachaSave(snapshot.data())
    : createEmptyGachaSave();

  await writeGachaCache(uid, save, storage);
  return readGachaCache(uid, storage) ?? save;
}

/**
 * 讀取玩家目前的代幣餘額（來源：單字大冒險的 gameProgress/{uid}）。
 * 文件不存在或欄位缺漏一律回傳 0。
 */
export async function loadPlayerCoins(uid: string): Promise<number> {
  assertUid(uid);
  const [{ doc, getDocFromServer }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const progressRef = doc(db, "gameProgress", uid);
  const snapshot = await getDocFromServer(progressRef);
  return snapshot.exists() ? parseCoins(snapshot.data()) : 0;
}

export async function recordGachaAttempt(
  uid: string,
  outcome: GachaOutcome,
  expectedResetVersion: number,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<CommittedGachaAttempt> {
  assertUid(uid);
  assertGachaOutcome(outcome);
  assertResetVersion(expectedResetVersion);

  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);
  const progressRef = doc(db, "gameProgress", uid);

  const committed = await runTransaction(db, async (transaction) => {
    // 扣款與抽獎結果在同一筆交易：付了款一定有結果，沒付款就不會有結果
    const [snapshot, progressSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(progressRef),
    ]);
    const rawData = snapshot.exists() ? snapshot.data() : null;
    const currentSave = snapshot.exists()
      ? normalizeGachaSave(rawData)
      : createEmptyGachaSave();

    if (currentSave.resetVersion !== expectedResetVersion) {
      throw new GachaResetConflictError(
        expectedResetVersion,
        currentSave.resetVersion,
      );
    }

    const availableCoins = progressSnapshot.exists()
      ? parseCoins(progressSnapshot.data())
      : 0;
    if (availableCoins < GACHA_DRAW_COST) {
      throw new GachaInsufficientCoinsError(GACHA_DRAW_COST, availableCoins);
    }
    const coinsAfter = availableCoins - GACHA_DRAW_COST;

    const applied = applyGachaAttempt(currentSave, outcome);
    const timestamp = serverTimestamp();
    const existingCreatedAt = isRecord(rawData) ? rawData.createdAt : undefined;
    const writeData: Record<string, unknown> = {
      schemaVersion: 1,
      resetVersion: applied.save.resetVersion,
      totalDraws: applied.save.totalDraws,
      updatedAt: timestamp,
    };

    if (outcome.kind === "character") {
      writeData.ownedCounts = {
        [outcome.characterId]: applied.save.ownedCounts[outcome.characterId],
      };
    } else if (!snapshot.exists()) {
      writeData.ownedCounts = {};
    }

    if (existingCreatedAt == null) {
      writeData.createdAt = timestamp;
    }

    if (snapshot.exists()) {
      transaction.set(ref, writeData, { merge: true });
    } else {
      transaction.set(ref, writeData);
    }
    transaction.update(progressRef, {
      coins: coinsAfter,
      updatedAt: timestamp,
    });
    return { ...applied, coinsAfter };
  });

  await writeGachaCache(uid, committed.save, storage);
  return committed;
}

export async function resetGachaCollection(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaSaveV1> {
  assertUid(uid);

  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);

  const committed = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const rawData = snapshot.exists() ? snapshot.data() : null;
    const currentSave = snapshot.exists()
      ? normalizeGachaSave(rawData)
      : createEmptyGachaSave();
    const resetSave: GachaSaveV1 = {
      schemaVersion: 1,
      resetVersion: currentSave.resetVersion + 1,
      totalDraws: 0,
      ownedCounts: {},
    };
    const timestamp = serverTimestamp();
    const resetData: Record<string, unknown> = {
      ...resetSave,
      resetAt: timestamp,
      updatedAt: timestamp,
    };
    const existingCreatedAt = isRecord(rawData) ? rawData.createdAt : undefined;

    if (existingCreatedAt == null) {
      resetData.createdAt = timestamp;
    }

    if (snapshot.exists()) {
      transaction.update(ref, resetData);
    } else {
      transaction.set(ref, resetData);
    }

    return resetSave;
  });

  await writeGachaCache(uid, committed, storage);
  return committed;
}
