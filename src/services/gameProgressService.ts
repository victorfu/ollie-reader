import {
  doc,
  getDoc,
  getDocFromServer,
  updateDoc,
  runTransaction,
  deleteField,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PlayerProgress, Stage } from "../types/game";
import { computeDailyBonus, type DailyBonusResult } from "./economyService";

// Firestore 文件路徑
const GAME_PROGRESS_PATH = "gameProgress";
const DAILY_CLAIM_CLOCK_FIELD = "dailyClaimServerClock";
const ADVENTURE_SETTLEMENT_RECEIPTS_FIELD = "adventureSettlementReceipts";
const MAX_ADVENTURE_SETTLEMENT_RECEIPTS = 128;
const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
export const GAME_PROGRESS_RESET_CONFLICT = "GAME_PROGRESS_RESET_CONFLICT";

export class GameProgressResetConflictError extends Error {
  readonly code = GAME_PROGRESS_RESET_CONFLICT;

  constructor() {
    super("Game progress was reset in another tab.");
    this.name = "GameProgressResetConflictError";
  }
}

export function isGameProgressResetConflictError(
  error: unknown,
): error is GameProgressResetConflictError {
  return (
    error instanceof GameProgressResetConflictError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === GAME_PROGRESS_RESET_CONFLICT)
  );
}

function legacySpiritFieldDeletes() {
  return {
    unlockedSpiritIds: deleteField(),
    evolvedSpiritIds: deleteField(),
    elementProgress: deleteField(),
  };
}

// 預設玩家進度
export const DEFAULT_PLAYER_PROGRESS: Omit<
  PlayerProgress,
  "odl" | "createdAt" | "updatedAt"
> = {
  level: 1,
  exp: 0,
  expToNextLevel: 100,
  currentStageIndex: 0,
  totalQuizCompleted: 0,
  totalBossDefeated: 0,
  highestCombo: 0,
  resetVersion: 0,
  // 經濟系統
  // 保留既有欄位名稱以相容舊存檔；UI 中統一稱為「扭蛋代幣」
  coins: 0,
  streakDays: 0,
  lastLoginDate: "",
  lastDailyClaimDate: "",
};

// 關卡定義
export const STAGES: Stage[] = [
  {
    id: "stage-1",
    name: "草原入口",
    stageNumber: 1,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 50,
    questionCount: 5,
  },
  {
    id: "stage-2",
    name: "森林小徑",
    stageNumber: 2,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 60,
    questionCount: 5,
  },
  {
    id: "stage-3",
    name: "神秘池塘",
    stageNumber: 3,
    isBoss: false,
    requiredLevel: 2,
    rewardExp: 70,
    questionCount: 5,
  },
  {
    id: "boss-1",
    name: "守護者之戰",
    stageNumber: 4,
    isBoss: true,
    requiredLevel: 2,
    rewardExp: 150,
    bossHp: 5,
    questionCount: 5,
  },
  {
    id: "stage-4",
    name: "雷電山谷",
    stageNumber: 5,
    isBoss: false,
    requiredLevel: 3,
    rewardExp: 80,
    questionCount: 5,
  },
  {
    id: "stage-5",
    name: "花園迷宮",
    stageNumber: 6,
    isBoss: false,
    requiredLevel: 3,
    rewardExp: 90,
    questionCount: 5,
  },
  {
    id: "boss-2",
    name: "冰霜挑戰",
    stageNumber: 7,
    isBoss: true,
    requiredLevel: 4,
    rewardExp: 200,
    bossHp: 8,
    questionCount: 8,
  },
  {
    id: "stage-6",
    name: "火焰試煉",
    stageNumber: 8,
    isBoss: false,
    requiredLevel: 5,
    rewardExp: 100,
    questionCount: 5,
  },
  {
    id: "boss-3",
    name: "鳳凰之巔",
    stageNumber: 9,
    isBoss: true,
    requiredLevel: 6,
    rewardExp: 300,
    bossHp: 10,
    questionCount: 10,
  },
  {
    id: "boss-4",
    name: "雷龍覺醒",
    stageNumber: 10,
    isBoss: true,
    requiredLevel: 8,
    rewardExp: 500,
    bossHp: 12,
    questionCount: 12,
  },
  {
    id: "stage-7",
    name: "星空之路",
    stageNumber: 11,
    isBoss: false,
    requiredLevel: 9,
    rewardExp: 110,
    questionCount: 5,
  },
  {
    id: "stage-8",
    name: "大地迴廊",
    stageNumber: 12,
    isBoss: false,
    requiredLevel: 9,
    rewardExp: 120,
    questionCount: 5,
  },
  {
    id: "boss-5",
    name: "風暴之巔",
    stageNumber: 13,
    isBoss: true,
    requiredLevel: 10,
    rewardExp: 600,
    bossHp: 15,
    questionCount: 15,
  },

  // ===== 第二章「雲頂星夢國」=====
  {
    id: "stage-9",
    name: "棉花糖雲海",
    stageNumber: 14,
    isBoss: false,
    requiredLevel: 10,
    rewardExp: 300,
    rewardCoins: 30,
    questionCount: 5,
    chapterId: "ch2",
    questionKinds: ["meaning", "listen"],
  },
  {
    id: "stage-10",
    name: "星光糖果街",
    stageNumber: 15,
    isBoss: false,
    requiredLevel: 10,
    rewardExp: 340,
    rewardCoins: 30,
    questionCount: 5,
    chapterId: "ch2",
    questionKinds: ["meaning", "emoji"],
  },
  {
    id: "stage-11",
    name: "彩虹布丁橋",
    stageNumber: 16,
    isBoss: false,
    requiredLevel: 10,
    rewardExp: 380,
    rewardCoins: 35,
    questionCount: 5,
    chapterId: "ch2",
    questionKinds: ["listen", "emoji"],
  },
  {
    id: "boss-6",
    name: "棉花糖守衛",
    stageNumber: 17,
    isBoss: true,
    requiredLevel: 11,
    rewardExp: 800,
    rewardCoins: 60,
    bossHp: 5,
    questionCount: 8,
    chapterId: "ch2",
    questionKinds: ["listen", "meaning"],
  },
  {
    id: "stage-12",
    name: "巧克力瀑布",
    stageNumber: 18,
    isBoss: false,
    requiredLevel: 11,
    rewardExp: 420,
    rewardCoins: 35,
    questionCount: 5,
    chapterId: "ch2",
    questionKinds: ["reverse"],
  },
  {
    id: "stage-13",
    name: "夢境旋轉木馬",
    stageNumber: 19,
    isBoss: false,
    requiredLevel: 12,
    rewardExp: 460,
    rewardCoins: 40,
    questionCount: 5,
    chapterId: "ch2",
    questionKinds: ["spell"],
  },
  {
    id: "boss-7",
    name: "焦糖魔術師",
    stageNumber: 20,
    isBoss: true,
    requiredLevel: 12,
    rewardExp: 900,
    rewardCoins: 70,
    bossHp: 7,
    questionCount: 10,
    chapterId: "ch2",
    questionKinds: ["reverse", "spell"],
  },
  {
    id: "stage-14",
    name: "月光棉花田",
    stageNumber: 21,
    isBoss: false,
    requiredLevel: 13,
    rewardExp: 500,
    rewardCoins: 40,
    questionCount: 6,
    chapterId: "ch2",
    questionKinds: ["meaning", "listen", "reverse", "emoji", "spell"],
  },
  {
    id: "stage-15",
    name: "星塵摩天輪",
    stageNumber: 22,
    isBoss: false,
    requiredLevel: 13,
    rewardExp: 540,
    rewardCoins: 45,
    questionCount: 6,
    chapterId: "ch2",
    questionKinds: ["meaning", "listen", "reverse", "emoji", "spell"],
  },
  {
    id: "boss-8",
    name: "星夢女王",
    stageNumber: 23,
    isBoss: true,
    requiredLevel: 14,
    rewardExp: 1400,
    rewardCoins: 120,
    bossHp: 9,
    questionCount: 12,
    chapterId: "ch2",
    questionKinds: ["meaning", "listen", "reverse", "emoji", "spell"],
  },
];

// 等級經驗值表（升到該等級所需總經驗）
export const LEVEL_EXP_TABLE: number[] = [
  0, // Level 1 (起始)
  100, // Level 2
  250, // Level 3
  450, // Level 4
  700, // Level 5
  1000, // Level 6
  1400, // Level 7
  1900, // Level 8
  2500, // Level 9
  3200, // Level 10
  4000, // Level 11
  5000, // Level 12
  6200, // Level 13
  7600, // Level 14
  9200, // Level 15 (最高)
];

function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    const millis = value.toMillis();
    return typeof millis === "number" && Number.isFinite(millis)
      ? millis
      : null;
  }
  return null;
}

function progressFromData(
  uid: string,
  data: Record<string, unknown>,
): PlayerProgress {
  // Only remove migration/server-only fields from a copy. Firestore snapshots
  // are treated as immutable by callers and may be shared by the SDK cache.
  const clean = { ...data };
  delete clean.unlockedSpiritIds;
  delete clean.evolvedSpiritIds;
  delete clean.elementProgress;
  delete clean[DAILY_CLAIM_CLOCK_FIELD];
  delete clean[ADVENTURE_SETTLEMENT_RECEIPTS_FIELD];

  const merged = {
    ...DEFAULT_PLAYER_PROGRESS,
    ...clean,
    odl: typeof clean.odl === "string" ? clean.odl : uid,
    createdAt: timestampMillis(clean.createdAt) ?? clean.createdAt,
    updatedAt: timestampMillis(clean.updatedAt) ?? clean.updatedAt,
  } as PlayerProgress;
  merged.coins = parseStoredTokenBalance(merged.coins);

  // Repair legacy saves whose level was capped below the current table.
  const recomputed = calculateLevelUp(merged.level, merged.exp, 0);
  merged.level = recomputed.newLevel;
  merged.expToNextLevel = recomputed.expToNextLevel;
  return merged;
}

/**
 * 獲取玩家遊戲進度
 */
export async function fetchProgress(
  uid: string,
): Promise<PlayerProgress | null> {
  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return progressFromData(uid, docSnap.data());
    }
    return null;
  } catch (error) {
    console.error("Error fetching game progress:", error);
    throw error;
  }
}

/**
 * 建立新玩家進度
 */
export async function createProgress(uid: string): Promise<PlayerProgress> {
  try {
    const now = Date.now();
    const newProgress: PlayerProgress = {
      ...DEFAULT_PLAYER_PROGRESS,
      odl: uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (snapshot.exists()) {
        return progressFromData(uid, snapshot.data());
      }

      transaction.set(docRef, {
        ...newProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return newProgress;
    });
  } catch (error) {
    console.error("Error creating game progress:", error);
    throw error;
  }
}

/**
 * 獲取或建立玩家進度
 */
export async function getOrCreateProgress(
  uid: string,
): Promise<PlayerProgress> {
  // Keep the cache-friendly read path for an existing offline player. If the
  // document appears absent, createProgress performs a second existence check
  // and the conditional create in one transaction. A delayed unconditional
  // set from another tab can therefore never erase rewards.
  const existing = await fetchProgress(uid);
  if (existing) return existing;
  return createProgress(uid);
}

/**
 * 更新玩家進度
 */
export async function saveProgress(
  uid: string,
  data: Partial<Omit<PlayerProgress, "odl" | "createdAt" | "updatedAt">>,
): Promise<void> {
  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    await updateDoc(docRef, {
      ...data,
      ...legacySpiritFieldDeletes(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving game progress:", error);
    throw error;
  }
}

/**
 * 冒險結算必須描述「本輪增量」，不能傳 caller 預先算好的絕對 progress。
 * Firestore retry 時會用最新 snapshot 重算等級、關卡與統計，避免另一分頁
 * 已完成的進度被 stale data 蓋回去。
 *
 * `coins` 是舊存檔沿用的欄位名稱。同一筆 Firestore transaction 會驗證
 * 重設版本並從最新餘額加值，避免覆蓋另一分頁的抽卡扣款或復活舊進度。
 * 最近 128 筆 settlement receipt 也保存在同一份既有 progress 文件，讓
 * ambiguous retry 保持冪等而不需要新的 Firestore path/rules 或無限成長。
 */
export type AdventureSettlement =
  | {
      settlementId: string;
      outcome: "victory";
      stageIndex: number;
      expGained: number;
      maxCombo: number;
      bossDefeated: boolean;
    }
  | { settlementId: string; outcome: "defeat" };

export interface AdventureSettlementResult {
  tokenBalance: number;
  progress: Pick<
    PlayerProgress,
    | "level"
    | "exp"
    | "expToNextLevel"
    | "currentStageIndex"
    | "totalQuizCompleted"
    | "highestCombo"
    | "totalBossDefeated"
    | "resetVersion"
    | "coins"
  >;
  didLevelUp: boolean;
  isNewHighScore: boolean;
}

function storedProgressNumber(
  value: unknown,
  fallback: number,
  minimum = 0,
): number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum
    ? value
    : fallback;
}

function settlementProgressFromData(
  data: Record<string, unknown>,
): AdventureSettlementResult["progress"] {
  const currentLevel = Math.min(
    storedProgressNumber(data.level, 1, 1),
    LEVEL_EXP_TABLE.length,
  );
  const currentExp = storedProgressNumber(data.exp, 0);
  const levelResult = calculateLevelUp(currentLevel, currentExp, 0);
  const coins = parseStoredTokenBalance(data.coins);
  return {
    level: levelResult.newLevel,
    exp: levelResult.newExp,
    expToNextLevel: levelResult.expToNextLevel,
    currentStageIndex: storedProgressNumber(data.currentStageIndex, 0),
    totalQuizCompleted: storedProgressNumber(data.totalQuizCompleted, 0),
    highestCombo: storedProgressNumber(data.highestCombo, 0),
    totalBossDefeated: storedProgressNumber(data.totalBossDefeated, 0),
    resetVersion: parseStoredTokenBalance(data.resetVersion),
    coins,
  };
}

interface StoredAdventureSettlementReceipt {
  settlementId: string;
  resetVersion: number;
  didLevelUp: boolean;
  isNewHighScore: boolean;
}

function parseAdventureSettlementReceipts(
  value: unknown,
): StoredAdventureSettlementReceipt[] {
  if (!Array.isArray(value)) return [];

  const receipts: StoredAdventureSettlementReceipt[] = [];
  const seen = new Set<string>();
  // Read newest-to-oldest so a dirty duplicate cannot shadow the most recent
  // committed receipt, then restore chronological order for bounded writes.
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const item = value[index];
    if (!item || typeof item !== "object") continue;
    const data = item as Record<string, unknown>;
    const settlementId = data.settlementId;
    if (
      typeof settlementId !== "string" ||
      !settlementId ||
      settlementId.length > 128 ||
      settlementId.includes("/") ||
      seen.has(settlementId)
    ) {
      continue;
    }
    const resetVersion = data.resetVersion;
    if (
      typeof resetVersion !== "number" ||
      !Number.isSafeInteger(resetVersion) ||
      resetVersion < 0
    ) {
      continue;
    }
    seen.add(settlementId);
    receipts.push({
      settlementId,
      resetVersion,
      didLevelUp: data.didLevelUp === true,
      isNewHighScore: data.isNewHighScore === true,
    });
  }
  return receipts.reverse();
}

export async function saveProgressWithTokenReward(
  uid: string,
  settlement: AdventureSettlement,
  tokensGained: number,
  expectedResetVersion: number,
): Promise<AdventureSettlementResult> {
  if (
    !settlement.settlementId ||
    settlement.settlementId.length > 128 ||
    settlement.settlementId.includes("/")
  ) {
    throw new RangeError("Settlement ID is invalid.");
  }
  if (!Number.isSafeInteger(tokensGained) || tokensGained < 0) {
    throw new RangeError("Token reward must be a non-negative safe integer.");
  }
  if (
    !Number.isSafeInteger(expectedResetVersion) ||
    expectedResetVersion < 0
  ) {
    throw new RangeError("Reset version must be a non-negative safe integer.");
  }
  if (settlement.outcome === "victory") {
    if (
      !Number.isSafeInteger(settlement.stageIndex) ||
      settlement.stageIndex < 0
    ) {
      throw new RangeError("Stage index must be a non-negative safe integer.");
    }
    if (
      !Number.isSafeInteger(settlement.expGained) ||
      settlement.expGained < 0
    ) {
      throw new RangeError("Experience reward must be a non-negative safe integer.");
    }
    if (
      !Number.isSafeInteger(settlement.maxCombo) ||
      settlement.maxCombo < 0
    ) {
      throw new RangeError("Maximum combo must be a non-negative safe integer.");
    }
  }

  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists()) {
        throw new GameProgressResetConflictError();
      }

      const stored = snapshot.data();
      const latestProgress = settlementProgressFromData(stored);
      const receipts = parseAdventureSettlementReceipts(
        stored[ADVENTURE_SETTLEMENT_RECEIPTS_FIELD],
      );
      const existingReceipt = receipts.find(
        (receipt) => receipt.settlementId === settlement.settlementId,
      );
      if (existingReceipt) {
        if (
          existingReceipt.resetVersion !== latestProgress.resetVersion ||
          existingReceipt.resetVersion !== expectedResetVersion
        ) {
          throw new GameProgressResetConflictError();
        }
        return {
          tokenBalance: latestProgress.coins,
          progress: latestProgress,
          didLevelUp: existingReceipt.didLevelUp,
          isNewHighScore: existingReceipt.isNewHighScore,
        };
      }

      const resetVersion = parseStoredTokenBalance(stored.resetVersion);
      if (resetVersion !== expectedResetVersion) {
        throw new GameProgressResetConflictError();
      }

      const storedProgress = settlementProgressFromData(stored);
      const currentBalance = storedProgress.coins;
      if (currentBalance > Number.MAX_SAFE_INTEGER - tokensGained) {
        throw new RangeError("Token balance exceeds the safe integer limit.");
      }
      const tokenBalance = currentBalance + tokensGained;
      const levelResult = calculateLevelUp(
        storedProgress.level,
        storedProgress.exp,
        settlement.outcome === "victory" ? settlement.expGained : 0,
      );
      const progress = {
        level: levelResult.newLevel,
        exp: levelResult.newExp,
        expToNextLevel: levelResult.expToNextLevel,
        currentStageIndex:
          settlement.outcome === "victory"
            ? Math.max(
                storedProgress.currentStageIndex,
                settlement.stageIndex + 1,
              )
            : storedProgress.currentStageIndex,
        totalQuizCompleted:
          storedProgress.totalQuizCompleted +
          (settlement.outcome === "victory" ? 1 : 0),
        highestCombo:
          settlement.outcome === "victory"
            ? Math.max(storedProgress.highestCombo, settlement.maxCombo)
            : storedProgress.highestCombo,
        totalBossDefeated:
          storedProgress.totalBossDefeated +
          (settlement.outcome === "victory" && settlement.bossDefeated ? 1 : 0),
        resetVersion,
        coins: tokenBalance,
      };
      const result = {
        tokenBalance,
        progress,
        didLevelUp:
          settlement.outcome === "victory" && levelResult.didLevelUp,
        isNewHighScore:
          settlement.outcome === "victory" &&
          settlement.maxCombo > storedProgress.highestCombo,
      };

      transaction.update(docRef, {
        ...(settlement.outcome === "victory" ? progress : {}),
        ...legacySpiritFieldDeletes(),
        coins: tokenBalance,
        [ADVENTURE_SETTLEMENT_RECEIPTS_FIELD]: [
          ...receipts
            .filter((receipt) => receipt.resetVersion === resetVersion)
            .slice(-(MAX_ADVENTURE_SETTLEMENT_RECEIPTS - 1)),
          {
            settlementId: settlement.settlementId,
            resetVersion,
            didLevelUp: result.didLevelUp,
            isNewHighScore: result.isNewHighScore,
          },
        ],
        updatedAt: serverTimestamp(),
      });
      return result;
    });
  } catch (error) {
    console.error("Error saving game progress with token reward:", error);
    throw error;
  }
}

export interface DailyTokenClaimResult {
  claimed: boolean;
  claimDate: string;
  tokenBalance: number;
  streakDays: number;
}

export interface DailyTokenBonusPreview {
  claimDate: string;
  bonus: DailyBonusResult;
}

function parseStoredTokenBalance(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function taipeiDateFromMillis(millis: number): string {
  const date = new Date(millis + TAIPEI_UTC_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readServerClaimState(uid: string) {
  const docRef = doc(db, GAME_PROGRESS_PATH, uid);
  // Resolve a serverTimestamp before reading. Unlike Date.now()/Timestamp.now(),
  // this value is assigned by Firestore and cannot be advanced by changing the
  // browser clock. A fixed app timezone also prevents timezone hopping.
  await updateDoc(docRef, { [DAILY_CLAIM_CLOCK_FIELD]: serverTimestamp() });
  const snapshot = await getDocFromServer(docRef);
  if (!snapshot.exists()) throw new Error("Player progress does not exist.");
  const millis = timestampMillis(snapshot.data()[DAILY_CLAIM_CLOCK_FIELD]);
  if (millis === null) throw new Error("Server claim time is unavailable.");
  return {
    claimDate: taipeiDateFromMillis(millis),
    data: snapshot.data(),
  };
}

export async function getDailyTokenBonusPreview(
  uid: string,
): Promise<DailyTokenBonusPreview> {
  const { claimDate, data } = await readServerClaimState(uid);
  return {
    claimDate,
    bonus: computeDailyBonus(
      typeof data.lastDailyClaimDate === "string"
        ? data.lastDailyClaimDate
        : "",
      claimDate,
      parseStoredTokenBalance(data.streakDays),
    ),
  };
}

/**
 * 每日獎勵的日期與金額都在服務內由 Firestore server time 推導。交易仍以
 * lastDailyClaimDate 做冪等檢查，所以多分頁同時領取只會有一筆成功。
 */
export async function claimDailyTokenBonus(
  uid: string,
): Promise<DailyTokenClaimResult> {
  const { claimDate } = await readServerClaimState(uid);

  const docRef = doc(db, GAME_PROGRESS_PATH, uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) {
      throw new Error("Player progress does not exist.");
    }

    const data = snapshot.data();
    const currentBalance = parseStoredTokenBalance(data.coins);
    if (data.lastDailyClaimDate === claimDate) {
      return {
        claimed: false,
        claimDate,
        tokenBalance: currentBalance,
        streakDays: parseStoredTokenBalance(data.streakDays),
      };
    }
    const bonus = computeDailyBonus(
      typeof data.lastDailyClaimDate === "string"
        ? data.lastDailyClaimDate
        : "",
      claimDate,
      parseStoredTokenBalance(data.streakDays),
    );
    const tokens = bonus.coins;
    if (currentBalance > Number.MAX_SAFE_INTEGER - tokens) {
      throw new RangeError("Token balance exceeds the safe integer limit.");
    }

    const tokenBalance = currentBalance + tokens;
    transaction.update(docRef, {
      coins: tokenBalance,
      ...legacySpiritFieldDeletes(),
      streakDays: bonus.streakDays,
      lastDailyClaimDate: claimDate,
      lastLoginDate: claimDate,
      updatedAt: serverTimestamp(),
    });
    return {
      claimed: true,
      claimDate,
      tokenBalance,
      streakDays: bonus.streakDays,
    };
  });
}

/**
 * 重設遊戲進度
 */
export async function resetGameProgress(uid: string): Promise<void> {
  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const previousResetVersion = snapshot.exists()
        ? parseStoredTokenBalance(snapshot.data().resetVersion)
        : -1;
      if (previousResetVersion >= Number.MAX_SAFE_INTEGER) {
        throw new RangeError("Reset version exceeds the safe integer limit.");
      }

      transaction.set(docRef, {
        ...DEFAULT_PLAYER_PROGRESS,
        resetVersion: previousResetVersion + 1,
        odl: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("Error resetting game progress:", error);
    throw error;
  }
}

/**
 * 計算獲得經驗後的等級變化
 */
export function calculateLevelUp(
  currentLevel: number,
  currentExp: number,
  expGained: number,
): {
  newLevel: number;
  newExp: number;
  expToNextLevel: number;
  didLevelUp: boolean;
} {
  const totalExp = currentExp + expGained;
  let level = currentLevel;
  let didLevelUp = false;

  // 檢查是否升級（最高等級由 LEVEL_EXP_TABLE 決定）
  while (level < LEVEL_EXP_TABLE.length && totalExp >= LEVEL_EXP_TABLE[level]) {
    level++;
    didLevelUp = true;
  }

  // 計算到下一級還需要多少經驗
  const expToNextLevel =
    level < LEVEL_EXP_TABLE.length ? LEVEL_EXP_TABLE[level] - totalExp : 0;

  return {
    newLevel: level,
    newExp: totalExp,
    expToNextLevel: Math.max(0, expToNextLevel),
    didLevelUp,
  };
}

/**
 * 獲取關卡資訊
 */
export function getStageById(stageId: string): Stage | undefined {
  return STAGES.find((s) => s.id === stageId);
}

/**
 * 獲取玩家可用的關卡
 */
export function getAvailableStages(
  playerLevel: number,
  currentStageIndex: number,
): Stage[] {
  return STAGES.filter((stage, index) => {
    // 必須達到關卡要求等級
    if (playerLevel < stage.requiredLevel) return false;
    // 必須按順序解鎖（只能玩已解鎖的關卡 + 下一關）
    if (index > currentStageIndex + 1) return false;
    return true;
  });
}

/**
 * 檢查關卡是否已完成
 */
export function isStageCompleted(
  stageIndex: number,
  currentStageIndex: number,
): boolean {
  return stageIndex < currentStageIndex;
}

/**
 * 檢查關卡是否可遊玩
 */
export function isStagePlayable(
  stageIndex: number,
  playerLevel: number,
  currentStageIndex: number,
): boolean {
  const stage = STAGES[stageIndex];
  if (!stage) return false;
  if (playerLevel < stage.requiredLevel) return false;
  if (stageIndex > currentStageIndex) return false;
  return true;
}

/**
 * 原子地加扭蛋代幣，不動其他欄位。
 *
 * 給單字大冒險以外的遊戲用（目前是甜心防衛隊的通關獎勵）。刻意不沿用
 * `saveProgressWithTokenReward`——那支綁著冒險進度的欄位與 resetVersion 驗證，
 * 對「只是想加錢」的呼叫端來說是不相干的耦合，而且會在文件不存在時直接丟錯。
 *
 * 用 transaction 從最新餘額加值，才不會蓋掉另一個分頁剛扣掉的抽卡費用。
 */
export async function awardGameCoins(
  uid: string,
  amount: number,
): Promise<number> {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("Coin reward must be a non-negative safe integer.");
  }
  if (amount === 0) return fetchProgress(uid).then((p) => p?.coins ?? 0);

  // 沒玩過單字大冒險的人還沒有進度文件，先建一份再加值。
  await getOrCreateProgress(uid);

  const docRef = doc(db, GAME_PROGRESS_PATH, uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const current = snapshot.exists()
      ? parseStoredTokenBalance(snapshot.data().coins)
      : 0;

    if (current > Number.MAX_SAFE_INTEGER - amount) {
      throw new RangeError("Token balance exceeds the safe integer limit.");
    }

    const balance = current + amount;
    transaction.update(docRef, { coins: balance, updatedAt: serverTimestamp() });
    return balance;
  });
}
