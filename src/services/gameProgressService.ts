import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  deleteField,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PlayerProgress, Stage } from "../types/game";

// Firestore 文件路徑
const GAME_PROGRESS_PATH = "gameProgress";
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
  return error instanceof GameProgressResetConflictError || (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === GAME_PROGRESS_RESET_CONFLICT
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
      const data = docSnap.data();
      // 精靈系統已移除：略過舊存檔殘留的精靈欄位，避免它們混進型別
      delete data.unlockedSpiritIds;
      delete data.evolvedSpiritIds;
      delete data.elementProgress;
      // 讀取時 backfill：舊存檔缺新欄位 → 先鋪預設值再蓋上存檔值（存檔值優先）
      const merged = {
        ...DEFAULT_PLAYER_PROGRESS,
        ...data,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toMillis()
            : data.updatedAt,
      } as PlayerProgress;
      // 舊版欄位若缺失或遭破壞，與扭蛋端一致地視為 0 代幣
      merged.coins = parseStoredTokenBalance(merged.coins);
      // 重算等級：被舊 L10 上限卡住的玩家，把累積的 exp 對到新的 15 級表
      // （只更新 expToNextLevel 會讓 level 停在 10、與 exp 不一致並卡住新章節）
      const recomputed = calculateLevelUp(merged.level, merged.exp, 0);
      merged.level = recomputed.newLevel;
      merged.expToNextLevel = recomputed.expToNextLevel;
      return merged;
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
    await setDoc(docRef, {
      ...newProgress,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newProgress;
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
 * 儲存冒險進度並原子增加扭蛋代幣。
 *
 * `coins` 是舊存檔沿用的欄位名稱。同一筆 Firestore transaction 會驗證
 * 重設版本並從最新餘額加值，避免覆蓋另一分頁的抽卡扣款或復活舊進度。
 */
export async function saveProgressWithTokenReward(
  uid: string,
  data: Partial<
    Omit<
      PlayerProgress,
      "odl" | "createdAt" | "updatedAt" | "coins" | "resetVersion"
    >
  >,
  tokensGained: number,
  expectedResetVersion: number,
): Promise<number> {
  if (!Number.isSafeInteger(tokensGained) || tokensGained < 0) {
    throw new RangeError("Token reward must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(expectedResetVersion) || expectedResetVersion < 0) {
    throw new RangeError("Reset version must be a non-negative safe integer.");
  }

  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists()) {
        throw new GameProgressResetConflictError();
      }

      const stored = snapshot.data();
      const resetVersion = parseStoredTokenBalance(stored.resetVersion);
      if (resetVersion !== expectedResetVersion) {
        throw new GameProgressResetConflictError();
      }

      const currentBalance = parseStoredTokenBalance(stored.coins);
      if (currentBalance > Number.MAX_SAFE_INTEGER - tokensGained) {
        throw new RangeError("Token balance exceeds the safe integer limit.");
      }
      const tokenBalance = currentBalance + tokensGained;
      transaction.update(docRef, {
        ...data,
        ...legacySpiritFieldDeletes(),
        coins: tokenBalance,
        updatedAt: serverTimestamp(),
      });
      return tokenBalance;
    });
  } catch (error) {
    console.error("Error saving game progress with token reward:", error);
    throw error;
  }
}

export interface DailyTokenClaimResult {
  claimed: boolean;
  tokenBalance: number;
  streakDays: number;
}

function parseStoredTokenBalance(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

/**
 * 每日獎勵以伺服器文件中的領取日期做冪等檢查，避免多分頁重複領取。
 */
export async function claimDailyTokenBonus(
  uid: string,
  claimDate: string,
  tokens: number,
  streakDays: number,
): Promise<DailyTokenClaimResult> {
  if (!claimDate) throw new RangeError("Claim date is required.");
  if (!Number.isSafeInteger(tokens) || tokens < 0) {
    throw new RangeError("Daily token reward must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(streakDays) || streakDays < 0) {
    throw new RangeError("Streak days must be a non-negative safe integer.");
  }

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
        tokenBalance: currentBalance,
        streakDays: parseStoredTokenBalance(data.streakDays),
      };
    }
    if (currentBalance > Number.MAX_SAFE_INTEGER - tokens) {
      throw new RangeError("Token balance exceeds the safe integer limit.");
    }

    const tokenBalance = currentBalance + tokens;
    transaction.update(docRef, {
      coins: tokenBalance,
      ...legacySpiritFieldDeletes(),
      streakDays,
      lastDailyClaimDate: claimDate,
      lastLoginDate: claimDate,
      updatedAt: serverTimestamp(),
    });
    return { claimed: true, tokenBalance, streakDays };
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

  // 檢查是否升級（最高 Level 10）
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
