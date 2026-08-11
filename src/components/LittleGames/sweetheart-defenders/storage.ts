import { getLevel, LEVELS } from "./data/levels";
import {
  applyRunResult,
  type CampaignProgress,
  type CoinReward,
  type RunApplication,
  type RunOutcome,
  type Stars,
} from "./engine/progress";

export const SWEETHEART_SCHEMA_VERSION = 1;
export const SWEETHEART_CLOUD_DOC = "sweetheartDefenders";
const CACHE_PREFIX = "ollie-sweetheart-defenders-cache-v1:";
/** 還沒登入時進度也存在本機，登入之後再併進雲端存檔。 */
const GUEST_KEY = "guest";

export type SweetheartSaveV1 = CampaignProgress & {
  schemaVersion: typeof SWEETHEART_SCHEMA_VERSION;
  updatedAt: number;
};

export type SaveStorage = Pick<Storage, "getItem" | "setItem"> &
  Partial<Pick<Storage, "removeItem">>;

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline";

export function createEmptySave(): SweetheartSaveV1 {
  return {
    schemaVersion: SWEETHEART_SCHEMA_VERSION,
    levelStars: {},
    bestWave: {},
    claimedClear: [],
    claimedThreeStars: [],
    updatedAt: 0,
  };
}

/**
 * 把任何來源的資料整理成合法的存檔。
 *
 * 雲端的資料可能是舊版本、被手動改過、或欄位缺一半；壞掉的欄位一律回退成
 * 預設值，不讓遊戲因為存檔髒掉就開不起來。指到不存在的關卡或角色的紀錄會被
 * 丟掉——那通常代表資料是更新前的版本留下來的。
 */
export function normalizeSave(raw: unknown): SweetheartSaveV1 {
  const base = createEmptySave();
  if (!isRecord(raw)) return base;

  const levelStars: Record<string, Stars> = {};
  if (isRecord(raw.levelStars)) {
    for (const [levelId, value] of Object.entries(raw.levelStars)) {
      if (!getLevel(levelId)) continue;
      const stars = toStars(value);
      if (stars > 0) levelStars[levelId] = stars;
    }
  }

  const bestWave: Record<string, number> = {};
  if (isRecord(raw.bestWave)) {
    for (const [levelId, value] of Object.entries(raw.bestWave)) {
      const level = getLevel(levelId);
      if (!level) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const wave = Math.floor(value);
      if (wave > 0) bestWave[levelId] = Math.min(wave, level.waves.length);
    }
  }

  return {
    schemaVersion: SWEETHEART_SCHEMA_VERSION,
    levelStars,
    bestWave,
    claimedClear: claimedLevelIds(raw.claimedClear),
    claimedThreeStars: claimedLevelIds(raw.claimedThreeStars),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : 0,
  };
}

/**
 * 合併兩份存檔。
 *
 * 這個遊戲的進度只會往前走——星數只增不減、領過的獎勵不會退回去、最遠波次
 * 只會更遠。所以兩台裝置的存檔不需要「誰比較新誰贏」，直接逐欄取較好的那個
 * 就好，兩邊的進度都不會不見。順帶讓寫入變成冪等的，也就不需要上鎖。
 */
export function mergeSaves(
  left: SweetheartSaveV1,
  right: SweetheartSaveV1,
): SweetheartSaveV1 {
  const levelStars: Record<string, Stars> = { ...left.levelStars };
  for (const [levelId, stars] of Object.entries(right.levelStars)) {
    levelStars[levelId] = Math.max(levelStars[levelId] ?? 0, stars) as Stars;
  }

  const bestWave: Record<string, number> = { ...left.bestWave };
  for (const [levelId, wave] of Object.entries(right.bestWave)) {
    bestWave[levelId] = Math.max(bestWave[levelId] ?? 0, wave);
  }

  return {
    schemaVersion: SWEETHEART_SCHEMA_VERSION,
    levelStars,
    bestWave,
    claimedClear: [...new Set([...left.claimedClear, ...right.claimedClear])],
    claimedThreeStars: [
      ...new Set([...left.claimedThreeStars, ...right.claimedThreeStars]),
    ],
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
  };
}

// === 本機快取 ===

export function getCacheKey(uid: string | null): string {
  return `${CACHE_PREFIX}${uid ?? GUEST_KEY}`;
}

export function defaultStorage(): SaveStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCache(
  uid: string | null,
  storage: SaveStorage | null = defaultStorage(),
): SweetheartSaveV1 | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(getCacheKey(uid));
    if (!raw) return null;
    return normalizeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 寫入本機。跟既有內容合併，所以多個分頁同時寫也不會互相蓋掉。 */
export function writeCache(
  uid: string | null,
  save: SweetheartSaveV1,
  storage: SaveStorage | null = defaultStorage(),
): SweetheartSaveV1 {
  const merged = mergeSaves(readCache(uid, storage) ?? createEmptySave(), save);
  if (!storage) return merged;

  try {
    storage.setItem(getCacheKey(uid), JSON.stringify(merged));
  } catch {
    // 無痕模式或容量滿了：雲端還在，不用讓遊戲中斷。
  }

  return merged;
}

/** 訪客進度登入後已搬進帳號快取，就不能再被下一個帳號重複承接。 */
export function clearCache(
  uid: string | null,
  storage: SaveStorage | null = defaultStorage(),
): void {
  if (!storage?.removeItem) return;
  try {
    storage.removeItem(getCacheKey(uid));
  } catch {
    // 無痕模式或儲存空間不可用：清不掉快取不應中斷遊戲。
  }
}

// === 雲端 ===

function assertUid(uid: string): void {
  if (!uid) throw new Error("需要 uid 才能存取雲端存檔");
}

/**
 * 跟扭蛋機共用 gameProgress/{uid}/littleGames/{doc} 這個路徑，
 * 現有的 Firestore 規則就涵蓋得到，不用另外開權限。
 */
async function cloudDoc(uid: string) {
  const [{ doc }, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  return doc(db, "gameProgress", uid, "littleGames", SWEETHEART_CLOUD_DOC);
}

export async function loadCloud(uid: string): Promise<SweetheartSaveV1> {
  assertUid(uid);

  const [{ getDocFromServer }, ref] = await Promise.all([
    import("firebase/firestore"),
    cloudDoc(uid),
  ]);
  const snapshot = await getDocFromServer(ref);

  return snapshot.exists() ? normalizeSave(snapshot.data()) : createEmptySave();
}

export async function saveCloud(
  uid: string,
  save: SweetheartSaveV1,
): Promise<SweetheartSaveV1> {
  assertUid(uid);

  const [firestore, { db }] = await Promise.all([
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  const ref = firestore.doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    SWEETHEART_CLOUD_DOC,
  );

  // merge:true 只會合併文件的第一層；stars map 與 claimed array 仍會整欄互蓋。
  // 在 transaction 內讀最新版本再逐欄 union，兩台裝置同時同步才不會 lost update。
  return firestore.runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const remote = snapshot.exists()
      ? normalizeSave(snapshot.data())
      : createEmptySave();
    const merged = mergeSaves(remote, normalizeSave(save));
    transaction.set(ref, merged);
    return merged;
  });
}

export type CloudRunSettlement = {
  save: SweetheartSaveV1;
  /** 這筆 transaction 實際發出的代幣；另一分頁先領走時會是 0。 */
  coinsEarned: number;
};

async function importSettlementDependencies() {
  const [service, firestore, firebase] = await Promise.all([
    import("../../../services/gameProgressService"),
    import("firebase/firestore"),
    import("../../../utils/firebaseUtil"),
  ]);
  return { service, firestore, db: firebase.db };
}

let settlementDependencies:
  | ReturnType<typeof importSettlementDependencies>
  | null = null;

function loadSettlementDependencies() {
  if (!settlementDependencies) {
    const pending = importSettlementDependencies().catch((error) => {
      // A transient chunk/network failure must not poison every later online
      // retry for the lifetime of this tab.
      if (settlementDependencies === pending) settlementDependencies = null;
      throw error;
    });
    settlementDependencies = pending;
  }
  return settlementDependencies;
}

/**
 * 原子提交一場結果與首次獎勵。
 *
 * 關卡 claim 與共用 coin balance 放在同一筆 Firestore transaction：並行完成同一
 * 關時只有第一筆會看到「未領」，不同關同時完成則會因 campaign 文件衝突而重試
 * 並 union 兩邊進度。這同時避免「錢已發但 claim 沒存」和相反方向的半套結果。
 */
export async function settleCloudRunResult(
  uid: string,
  localBase: SweetheartSaveV1,
  levelId: string,
  outcome: RunOutcome,
  reward: CoinReward,
): Promise<CloudRunSettlement> {
  return commitCloudProgress(uid, localBase, (base) =>
    applyRunResult(base, levelId, outcome, reward),
  );
}

/**
 * 登入／重連時把離線進度補進雲端，並原子補發「有星數但還沒 claim」的獎勵。
 * 訪客沒有可用的 coin wallet，因此訪客場次只記星數；第一次登入會走這裡發放。
 */
export async function syncCloudProgress(
  uid: string,
  localSave: SweetheartSaveV1,
): Promise<CloudRunSettlement> {
  return commitCloudProgress(uid, localSave, claimPendingRewards);
}

async function commitCloudProgress(
  uid: string,
  localBase: SweetheartSaveV1,
  apply: (base: SweetheartSaveV1) => RunApplication,
): Promise<CloudRunSettlement> {
  assertUid(uid);

  // 共用進度文件通常已存在；新玩家先建立完整預設欄位，transaction 才只需更新
  // coins，不會留下只有餘額、缺少冒險進度欄位的半份文件。
  const { service, firestore, db } = await loadSettlementDependencies();
  await service.getOrCreateProgress(uid);

  const campaignRef = firestore.doc(
    db,
    "gameProgress",
    uid,
    "littleGames",
    SWEETHEART_CLOUD_DOC,
  );
  const progressRef = firestore.doc(db, "gameProgress", uid);

  return firestore.runTransaction(db, async (transaction) => {
    const [campaignSnapshot, progressSnapshot] = await Promise.all([
      transaction.get(campaignRef),
      transaction.get(progressRef),
    ]);
    if (!progressSnapshot.exists()) {
      throw new Error("Player progress does not exist.");
    }

    const remote = campaignSnapshot.exists()
      ? normalizeSave(campaignSnapshot.data())
      : createEmptySave();
    const base = mergeSaves(remote, normalizeSave(localBase));
    const applied = apply(base);
    const committed: SweetheartSaveV1 = {
      ...base,
      ...applied.progress,
      updatedAt: Math.max(base.updatedAt, Date.now()),
    };

    const currentCoins = parseCoins(progressSnapshot.data().coins);
    if (currentCoins > Number.MAX_SAFE_INTEGER - applied.coinsEarned) {
      throw new RangeError("Token balance exceeds the safe integer limit.");
    }

    transaction.set(campaignRef, committed);
    if (applied.coinsEarned > 0) {
      transaction.update(progressRef, {
        coins: currentCoins + applied.coinsEarned,
        updatedAt: firestore.serverTimestamp(),
      });
    }

    return { save: committed, coinsEarned: applied.coinsEarned };
  });
}

function claimPendingRewards(progress: SweetheartSaveV1): RunApplication {
  const claimedClear = [...progress.claimedClear];
  const claimedThreeStars = [...progress.claimedThreeStars];
  let coinsEarned = 0;

  for (const level of LEVELS) {
    const stars = progress.levelStars[level.id] ?? 0;
    if (stars > 0 && !claimedClear.includes(level.id)) {
      claimedClear.push(level.id);
      coinsEarned += level.coinReward.clear;
    }
    if (stars >= 3 && !claimedThreeStars.includes(level.id)) {
      claimedThreeStars.push(level.id);
      coinsEarned += level.coinReward.threeStars;
    }
  }

  if (coinsEarned === 0) return { progress, coinsEarned: 0 };
  return {
    coinsEarned,
    progress: { ...progress, claimedClear, claimedThreeStars },
  };
}

/** 領獎紀錄只留還存在的關卡 id，順便濾掉髒資料。 */
function claimedLevelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && getLevel(id) !== undefined,
      ),
    ),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStars(value: unknown): Stars {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const rounded = Math.floor(value);
  if (rounded <= 0) return 0;
  return (rounded >= 3 ? 3 : rounded) as Stars;
}

function parseCoins(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}
