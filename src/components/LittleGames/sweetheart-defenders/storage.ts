import { getLevel } from "./data/levels";
import type { CampaignProgress, Stars } from "./engine/progress";

export const SWEETHEART_SCHEMA_VERSION = 1;
export const SWEETHEART_CLOUD_DOC = "sweetheartDefenders";
const CACHE_PREFIX = "ollie-sweetheart-defenders-cache-v1:";
/** 還沒登入時進度也存在本機，登入之後再併進雲端存檔。 */
const GUEST_KEY = "guest";

export type SweetheartSaveV1 = CampaignProgress & {
  schemaVersion: typeof SWEETHEART_SCHEMA_VERSION;
  updatedAt: number;
};

export type SaveStorage = Pick<Storage, "getItem" | "setItem">;

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
): Promise<void> {
  assertUid(uid);

  const [{ setDoc }, ref] = await Promise.all([
    import("firebase/firestore"),
    cloudDoc(uid),
  ]);

  await setDoc(ref, normalizeSave(save), { merge: true });
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
