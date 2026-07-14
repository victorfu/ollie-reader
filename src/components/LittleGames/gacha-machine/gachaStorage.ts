import {
  applyGachaDraw,
  createEmptyGachaSave,
  normalizeGachaSave,
} from "./gachaLogic";
import type {
  GachaCharacterId,
  GachaDrawResult,
  GachaSaveV1,
} from "./gachaTypes";
import { isGachaCharacterId } from "./gachaTypes";

export const GACHA_CACHE_PREFIX = "ollie-gacha-machine-cache-v1:";
export const GACHA_CLOUD_DOC = "gachaMachine";

export type GachaCacheStorage = Pick<Storage, "getItem" | "setItem">;
export type GachaCacheLockManager = {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getGachaCacheKey(uid: string): string {
  assertUid(uid);
  return `${GACHA_CACHE_PREFIX}${uid}`;
}

export function readGachaCache(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): GachaSaveV1 | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(getGachaCacheKey(uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return null;
    return normalizeGachaSave(parsed);
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
    if (current && current.totalDraws > normalized.totalDraws) {
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
      // A browser may expose Web Locks but reject a request in a restricted
      // context. Keep the monotonic fallback instead of losing the cache.
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

export async function recordGachaDraw(
  uid: string,
  characterId: GachaCharacterId,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaDrawResult> {
  assertUid(uid);
  if (!isGachaCharacterId(characterId)) {
    throw new Error(`Unknown gacha character: ${String(characterId)}`);
  }

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
    const applied = applyGachaDraw(currentSave, characterId);
    const existingCreatedAt = isRecord(rawData) ? rawData.createdAt : undefined;

    transaction.set(ref, {
      ...applied.save,
      createdAt: existingCreatedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return applied;
  });

  await writeGachaCache(uid, committed.save, storage);
  return committed.result;
}
