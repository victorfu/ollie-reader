import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../utils/firebaseUtil";
import type { PlayerProgress, Stage } from "../types/game";

// Firestore 文件路徑
const GAME_PROGRESS_PATH = "gameProgress";

// 預設玩家進度
export const DEFAULT_PLAYER_PROGRESS: Omit<
  PlayerProgress,
  "odl" | "createdAt" | "updatedAt"
> = {
  level: 1,
  exp: 0,
  expToNextLevel: 100,
  unlockedSpiritIds: ["cloud-puff"], // 初始贈送一隻普通精靈
  currentStageIndex: 0,
  totalQuizCompleted: 0,
  totalBossDefeated: 0,
  highestCombo: 0,
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
    rewardSpiritId: "leaf-bunny",
    questionCount: 5,
  },
  {
    id: "stage-2",
    name: "森林小徑",
    stageNumber: 2,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 60,
    rewardSpiritId: "fire-slime",
    questionCount: 5,
  },
  {
    id: "stage-3",
    name: "神秘池塘",
    stageNumber: 3,
    isBoss: false,
    requiredLevel: 2,
    rewardExp: 70,
    rewardSpiritId: "water-fox",
    questionCount: 5,
  },
  {
    id: "boss-1",
    name: "守護者之戰",
    stageNumber: 4,
    isBoss: true,
    requiredLevel: 2,
    rewardExp: 150,
    rewardSpiritId: "thunder-mouse",
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
    rewardSpiritId: "rock-turtle",
    questionCount: 5,
  },
  {
    id: "stage-5",
    name: "花園迷宮",
    stageNumber: 6,
    isBoss: false,
    requiredLevel: 3,
    rewardExp: 90,
    rewardSpiritId: "flower-sprite",
    questionCount: 5,
  },
  {
    id: "boss-2",
    name: "冰霜挑戰",
    stageNumber: 7,
    isBoss: true,
    requiredLevel: 4,
    rewardExp: 200,
    rewardSpiritId: "ice-wolf",
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
    rewardSpiritId: "star-owl",
    questionCount: 5,
  },
  {
    id: "boss-3",
    name: "鳳凰之巔",
    stageNumber: 9,
    isBoss: true,
    requiredLevel: 6,
    rewardExp: 300,
    rewardSpiritId: "fire-phoenix",
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
    rewardSpiritId: "thunder-dragon",
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
    rewardSpiritId: "shadow-cat",
    questionCount: 5,
  },
  {
    id: "stage-8",
    name: "大地迴廊",
    stageNumber: 12,
    isBoss: false,
    requiredLevel: 9,
    rewardExp: 120,
    rewardSpiritId: "earth-golem",
    questionCount: 5,
  },
  {
    id: "boss-5",
    name: "風暴之巔",
    stageNumber: 13,
    isBoss: true,
    requiredLevel: 10,
    rewardExp: 600,
    rewardSpiritId: "wind-eagle",
    bossHp: 15,
    questionCount: 15,
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
  3200, // Level 10 (最高)
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
      return {
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
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving game progress:", error);
    throw error;
  }
}

/**
 * 解鎖新精靈
 */
export async function unlockSpirit(
  uid: string,
  spiritId: string,
): Promise<void> {
  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    await updateDoc(docRef, {
      unlockedSpiritIds: arrayUnion(spiritId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error unlocking spirit:", error);
    throw error;
  }
}

/**
 * 重設遊戲進度
 */
export async function resetGameProgress(uid: string): Promise<void> {
  try {
    const docRef = doc(db, GAME_PROGRESS_PATH, uid);
    await setDoc(docRef, {
      ...DEFAULT_PLAYER_PROGRESS,
      odl: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
