import {
  GACHA_DRAW_COST,
  applyGachaAttempt,
  assertGachaOutcome,
  createEmptyGachaSave,
  normalizeGachaSave,
} from "./gachaLogic";
import type {
  CommittedGachaAttempt,
  GachaCloudPendingReveal,
  GachaDrawResult,
  GachaMachineState,
  GachaOutcome,
  GachaSaveV1,
} from "./gachaTypes";
import { isGachaCharacterId } from "./gachaTypes";

export const GACHA_CACHE_PREFIX = "ollie-gacha-machine-cache-v1:";
export const GACHA_CLOUD_DOC = "gachaMachine";
export const GACHA_RESET_CONFLICT = "GACHA_RESET_CONFLICT";
export const GACHA_INSUFFICIENT_COINS = "GACHA_INSUFFICIENT_COINS";
export const GACHA_PENDING_REVEAL_CONFLICT =
  "GACHA_PENDING_REVEAL_CONFLICT";

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

export class GachaPendingRevealConflictError extends Error {
  readonly code = GACHA_PENDING_REVEAL_CONFLICT;
  readonly attemptId: string;

  constructor(attemptId: string) {
    super("A paid gacha result is still waiting to be revealed.");
    this.name = "GachaPendingRevealConflictError";
    this.attemptId = attemptId;
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

export function isGachaPendingRevealConflictError(
  error: unknown,
): error is GachaPendingRevealConflictError {
  return error instanceof GachaPendingRevealConflictError ||
    (isRecord(error) && error.code === GACHA_PENDING_REVEAL_CONFLICT);
}

/** 從 Firestore 舊版 coins 欄位讀出代幣餘額（缺欄位/壞資料一律視為 0） */
function parseCoins(data: unknown): number {
  if (!isRecord(data)) return 0;
  const coins = data.coins;
  if (typeof coins !== "number" || !Number.isFinite(coins)) return 0;
  const normalized = Math.floor(coins);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function assertAttemptId(attemptId: string): void {
  if (attemptId.trim().length === 0 || attemptId.length > 200) {
    throw new Error("A valid gacha attempt id is required.");
  }
}

function createAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function parseCreatedAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (isRecord(value)) {
    const toMillis = value.toMillis;
    if (typeof toMillis === "function") {
      try {
        const millis: unknown = toMillis.call(value);
        if (typeof millis === "number" && Number.isFinite(millis) && millis >= 0) {
          return millis;
        }
      } catch {
        return null;
      }
    }
    if (
      typeof value.seconds === "number" &&
      Number.isFinite(value.seconds) &&
      typeof value.nanoseconds === "number" &&
      Number.isFinite(value.nanoseconds)
    ) {
      return value.seconds * 1_000 + Math.floor(value.nanoseconds / 1_000_000);
    }
  }
  return null;
}

function parseDrawResult(value: unknown): GachaDrawResult | null {
  if (!isRecord(value)) return null;
  if (
    value.kind === "miss" &&
    typeof value.totalDraws === "number" &&
    Number.isSafeInteger(value.totalDraws) &&
    value.totalDraws > 0
  ) {
    return { kind: "miss", totalDraws: value.totalDraws };
  }
  if (
    value.kind === "character" &&
    isGachaCharacterId(value.characterId) &&
    typeof value.isNew === "boolean" &&
    typeof value.ownedCount === "number" &&
    Number.isSafeInteger(value.ownedCount) &&
    value.ownedCount > 0 &&
    typeof value.totalDraws === "number" &&
    Number.isSafeInteger(value.totalDraws) &&
    value.totalDraws > 0
  ) {
    return {
      kind: "character",
      characterId: value.characterId,
      isNew: value.isNew,
      ownedCount: value.ownedCount,
      totalDraws: value.totalDraws,
    };
  }
  return null;
}

export function parseGachaCloudPendingReveal(
  value: unknown,
  currentSave: GachaSaveV1,
): GachaCloudPendingReveal | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.attemptId !== "string" ||
    value.attemptId.trim().length === 0 ||
    value.attemptId.length > 200 ||
    typeof value.resetVersion !== "number" ||
    !Number.isSafeInteger(value.resetVersion) ||
    value.resetVersion < 0 ||
    !isRecord(value.baselineSave) ||
    typeof value.coinsAfter !== "number" ||
    !Number.isSafeInteger(value.coinsAfter) ||
    value.coinsAfter < 0
  ) {
    return null;
  }
  const baselineSave = normalizeGachaSave(value.baselineSave);
  const result = parseDrawResult(value.result);
  const createdAt = parseCreatedAt(value.createdAt);
  if (
    !result ||
    createdAt === null ||
    value.resetVersion !== currentSave.resetVersion ||
    baselineSave.resetVersion !== currentSave.resetVersion ||
    baselineSave.totalDraws >= currentSave.totalDraws ||
    result.totalDraws !== currentSave.totalDraws
  ) {
    return null;
  }
  if (
    result.kind === "character" &&
    currentSave.ownedCounts[result.characterId] !== result.ownedCount
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    attemptId: value.attemptId,
    resetVersion: currentSave.resetVersion,
    baselineSave,
    committedAttempt: {
      save: currentSave,
      result,
      coinsAfter: value.coinsAfter,
    },
    createdAt,
  };
}

function serializePendingReveal(
  pendingReveal: GachaCloudPendingReveal,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    attemptId: pendingReveal.attemptId,
    resetVersion: pendingReveal.resetVersion,
    baselineSave: pendingReveal.baselineSave,
    result: pendingReveal.committedAttempt.result,
    coinsAfter: pendingReveal.committedAttempt.coinsAfter,
    createdAt: pendingReveal.createdAt,
  };
}

export function getGachaCacheKey(uid: string): string {
  assertUid(uid);
  return `${GACHA_CACHE_PREFIX}${uid}`;
}

/**
 * Save-only compatibility view. A paid result is committed before the player
 * opens its capsule, so legacy consumers must keep seeing the pre-draw save.
 */
export function parseGachaCacheValue(raw: string | null): GachaSaveV1 | null {
  const state = parseGachaMachineCacheState(raw);
  return state?.pendingReveal?.baselineSave ?? state?.save ?? null;
}

export function parseGachaMachineCacheState(
  raw: string | null,
): GachaMachineState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return null;
    const save = normalizeGachaSave(parsed);
    const pendingReveal = parseGachaCloudPendingReveal(
      parsed.pendingReveal,
      save,
    );
    const acknowledgedAttemptId =
      typeof parsed.acknowledgedAttemptId === "string"
        ? parsed.acknowledgedAttemptId
        : null;
    return {
      save,
      pendingReveal:
        pendingReveal?.attemptId === acknowledgedAttemptId
          ? null
          : pendingReveal,
    };
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

export function readGachaMachineCacheState(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): GachaMachineState | null {
  if (!storage) return null;
  try {
    return parseGachaMachineCacheState(
      storage.getItem(getGachaCacheKey(uid)),
    );
  } catch {
    return null;
  }
}

function writeGachaMachineCacheStateUnlocked(
  uid: string,
  state: GachaMachineState,
  storage: GachaCacheStorage | null,
  acknowledgedAttemptId?: string,
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizeGachaSave(state.save);
    const cacheKey = getGachaCacheKey(uid);
    const currentRaw = storage.getItem(cacheKey);
    const current = parseGachaMachineCacheState(currentRaw);
    if (current && compareGachaSaveVersions(current.save, normalized) > 0) {
      return true;
    }
    let currentAcknowledgedAttemptId: string | undefined;
    if (currentRaw) {
      const parsedCurrent: unknown = JSON.parse(currentRaw);
      if (
        isRecord(parsedCurrent) &&
        typeof parsedCurrent.acknowledgedAttemptId === "string"
      ) {
        currentAcknowledgedAttemptId = parsedCurrent.acknowledgedAttemptId;
      }
    }
    let acknowledged =
      acknowledgedAttemptId ?? currentAcknowledgedAttemptId;
    if (
      state.pendingReveal &&
      acknowledged &&
      state.pendingReveal.attemptId !== acknowledged
    ) {
      acknowledged = undefined;
    }
    const pendingReveal =
      state.pendingReveal?.attemptId === acknowledged
        ? null
        : state.pendingReveal;
    storage.setItem(
      cacheKey,
      JSON.stringify({
        ...normalized,
        ...(pendingReveal
          ? { pendingReveal: serializePendingReveal(pendingReveal) }
          : {}),
        ...(acknowledged ? { acknowledgedAttemptId: acknowledged } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function writeGachaMachineCacheState(
  uid: string,
  state: GachaMachineState,
  storage: GachaCacheStorage | null = defaultStorage(),
  lockManager: GachaCacheLockManager | null = defaultLockManager(),
  acknowledgedAttemptId?: string,
): Promise<boolean> {
  if (!storage) return false;
  if (lockManager) {
    try {
      return await lockManager.request(getGachaCacheKey(uid), () =>
        writeGachaMachineCacheStateUnlocked(
          uid,
          state,
          storage,
          acknowledgedAttemptId,
        ),
      );
    } catch {
      // Restricted contexts may expose Web Locks but reject lock requests.
    }
  }
  return writeGachaMachineCacheStateUnlocked(
    uid,
    state,
    storage,
    acknowledgedAttemptId,
  );
}

export async function writeGachaCache(
  uid: string,
  save: GachaSaveV1,
  storage: GachaCacheStorage | null = defaultStorage(),
  lockManager: GachaCacheLockManager | null = defaultLockManager(),
): Promise<boolean> {
  const normalized = normalizeGachaSave(save);
  const current = readGachaMachineCacheState(uid, storage);
  const pendingReveal =
    current?.pendingReveal?.resetVersion === normalized.resetVersion
      ? current.pendingReveal
      : null;
  return writeGachaMachineCacheState(
    uid,
    { save: normalized, pendingReveal },
    storage,
    lockManager,
  );
}

export async function loadGachaMachineState(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaMachineState> {
  assertUid(uid);
  const [{ doc, getDocFromServer }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);
  const snapshot = await getDocFromServer(ref);
  const rawData = snapshot.exists() ? snapshot.data() : null;
  const save = snapshot.exists()
    ? normalizeGachaSave(rawData)
    : createEmptyGachaSave();
  const state: GachaMachineState = {
    save,
    pendingReveal: isRecord(rawData)
      ? parseGachaCloudPendingReveal(rawData.pendingReveal, save)
      : null,
  };

  await writeGachaMachineCacheState(uid, state, storage);
  return readGachaMachineCacheState(uid, storage) ?? state;
}

export async function loadGachaCloud(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaSaveV1> {
  const state = await loadGachaMachineState(uid, storage);
  // Keep save-only callers spoiler-free until the capsule acknowledgement.
  return state.pendingReveal?.baselineSave ?? state.save;
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
  attemptId: string = createAttemptId(),
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<CommittedGachaAttempt> {
  assertUid(uid);
  assertGachaOutcome(outcome);
  assertResetVersion(expectedResetVersion);
  assertAttemptId(attemptId);

  const [{ doc, runTransaction, serverTimestamp }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);
  const progressRef = doc(db, "gameProgress", uid);

  const transactionResult = await runTransaction(db, async (transaction) => {
    // 扣款與抽獎結果在同一筆交易：付了款一定有結果，沒付款就不會有結果
    const [snapshot, progressSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(progressRef),
    ]);
    const rawData = snapshot.exists() ? snapshot.data() : null;
    const currentSave = snapshot.exists()
      ? normalizeGachaSave(rawData)
      : createEmptyGachaSave();

    const rawPendingReveal = isRecord(rawData)
      ? rawData.pendingReveal
      : undefined;
    const existingPendingReveal = parseGachaCloudPendingReveal(
      rawPendingReveal,
      currentSave,
    );
    if (rawPendingReveal != null) {
      if (existingPendingReveal?.attemptId === attemptId) {
        return {
          committed: existingPendingReveal.committedAttempt,
          pendingReveal: existingPendingReveal,
        };
      }
      throw new GachaPendingRevealConflictError(
        existingPendingReveal?.attemptId ?? "unknown",
      );
    }

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
    const pendingRevealData = {
      schemaVersion: 1,
      attemptId,
      resetVersion: applied.save.resetVersion,
      baselineSave: currentSave,
      result: applied.result,
      coinsAfter,
      createdAt: timestamp,
    };
    const existingCreatedAt = isRecord(rawData) ? rawData.createdAt : undefined;
    const writeData: Record<string, unknown> = {
      schemaVersion: 1,
      resetVersion: applied.save.resetVersion,
      totalDraws: applied.save.totalDraws,
      pendingReveal: pendingRevealData,
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
    const committed = { ...applied, coinsAfter };
    const pendingReveal: GachaCloudPendingReveal = {
      schemaVersion: 1,
      attemptId,
      resetVersion: applied.save.resetVersion,
      baselineSave: currentSave,
      committedAttempt: committed,
      createdAt: Date.now(),
    };
    return { committed, pendingReveal };
  });

  await writeGachaMachineCacheState(
    uid,
    {
      save: transactionResult.committed.save,
      pendingReveal: transactionResult.pendingReveal,
    },
    storage,
  );
  return transactionResult.committed;
}

export async function acknowledgeGachaPendingReveal(
  uid: string,
  attemptId: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<boolean> {
  assertUid(uid);
  assertAttemptId(attemptId);
  const [
    { deleteField, doc, runTransaction, serverTimestamp },
    { db },
  ] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = doc(db, "gameProgress", uid, "littleGames", GACHA_CLOUD_DOC);
  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      return {
        acknowledged: false,
        state: { save: createEmptyGachaSave(), pendingReveal: null },
      };
    }
    const rawData = snapshot.data();
    const save = normalizeGachaSave(rawData);
    const pendingReveal = isRecord(rawData)
      ? parseGachaCloudPendingReveal(rawData.pendingReveal, save)
      : null;
    if (!pendingReveal || pendingReveal.attemptId !== attemptId) {
      return {
        acknowledged: false,
        state: { save, pendingReveal },
      };
    }
    transaction.update(ref, {
      pendingReveal: deleteField(),
      updatedAt: serverTimestamp(),
    });
    return {
      acknowledged: true,
      state: { save, pendingReveal: null },
    };
  });
  await writeGachaMachineCacheState(
    uid,
    result.state,
    storage,
    defaultLockManager(),
    result.acknowledged || result.state.pendingReveal === null
      ? attemptId
      : undefined,
  );
  return result.acknowledged;
}

export async function resetGachaCollection(
  uid: string,
  storage: GachaCacheStorage | null = defaultStorage(),
): Promise<GachaSaveV1> {
  assertUid(uid);

  const [
    { deleteField, doc, runTransaction, serverTimestamp },
    { db },
  ] = await Promise.all([
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
      unknownOwnedCounts: {},
      resetAt: timestamp,
      updatedAt: timestamp,
    };
    const existingCreatedAt = isRecord(rawData) ? rawData.createdAt : undefined;

    if (existingCreatedAt == null) {
      resetData.createdAt = timestamp;
    }

    if (snapshot.exists()) {
      transaction.update(ref, {
        ...resetData,
        pendingReveal: deleteField(),
      });
    } else {
      transaction.set(ref, resetData);
    }

    return resetSave;
  });

  await writeGachaMachineCacheState(
    uid,
    { save: committed, pendingReveal: null },
    storage,
  );
  return committed;
}
