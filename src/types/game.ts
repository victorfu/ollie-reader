// ============ 精靈收集系統 ============

export type SpiritElement = "fire" | "water" | "grass" | "electric" | "normal";
export type SpiritRarity = "common" | "uncommon" | "rare" | "legendary";

// 精靈進化條件
export type EvolveCondition =
  | { type: "train"; element: SpiritElement; correctCount: number } // 該元素答對 N 題（啟用中）
  | { type: "level"; level: number }; // 玩家等級達標（保留，暫未使用）

export interface Spirit {
  id: string;
  name: string;
  element: SpiritElement;
  rarity: SpiritRarity;
  description: string;
  evolvesToId?: string; // 進化後的精靈 id
  evolvesFromId?: string; // 進化前的精靈 id
  evolveCondition?: EvolveCondition; // 進化條件（無 = 不可進化）
  source?: "stage" | "gacha"; // 取得來源（undefined 視為 stage，不會被扭蛋抽到）
}

export interface PlayerProgress {
  odl: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  unlockedSpiritIds: string[];
  currentStageIndex: number;
  totalQuizCompleted: number;
  totalBossDefeated: number;
  highestCombo: number;
  // 進化系統
  evolvedSpiritIds: string[]; // 已進化的「原始」精靈 id（防重複觸發）
  elementProgress: Partial<Record<SpiritElement, number>>; // 各元素累積答對題數
  // 經濟系統
  coins: number;
  streakDays: number;
  lastLoginDate: string; // 本地 YYYY-MM-DD
  lastDailyClaimDate: string; // 本地 YYYY-MM-DD（每日獎勵冪等用）
  createdAt: number;
  updatedAt: number;
}

export interface Stage {
  id: string;
  name: string;
  stageNumber: number;
  isBoss: boolean;
  requiredLevel: number;
  rewardExp: number;
  rewardSpiritId?: string; // 過關可獲得的精靈
  bossHp?: number; // Boss 戰專用
  questionCount: number; // 普通關卡題數
  chapterId?: string; // 所屬章節（undefined = 第一章）
  questionKinds?: QuizKind[]; // 本關題型組合（undefined = 全部 "meaning"）
  rewardCoins?: number; // 過關金幣（undefined = 用公式推算）
}

export type GameView =
  | "home"
  | "map"
  | "quiz"
  | "boss"
  | "shop"
  | "collection"
  | "reward";

// 題型判別子
export type QuizKind = "meaning" | "listen" | "spell" | "reverse" | "emoji";

interface BaseQuestion {
  kind: QuizKind;
  word: string; // 正解英文單字
  spiritId?: string; // 這題對應的精靈
}

// 四選一題型：meaning=看英文選中文 · listen=聽發音選中文 · reverse=看中文選英文 · emoji=看圖選中文
export interface OptionQuestion extends BaseQuestion {
  kind: "meaning" | "listen" | "reverse" | "emoji";
  prompt: string; // meaning=英文字 · reverse=中文 · emoji=emoji · listen=""（改用 TTS 唸）
  options: string[]; // 4 個選項
  correctIndex: number;
}

// 拼字題型：把打散的字母排回正確單字
export interface SpellQuestion extends BaseQuestion {
  kind: "spell";
  letters: string[]; // 打散後的字母 chips
  hint: string; // 中文提示（該字的意思）
}

export type QuizQuestion = OptionQuestion | SpellQuestion;

export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  timeLeft: number;
  lives: number;
  maxLives: number;
  score: number;
  combo: number;
  isAnswered: boolean;
  lastAnswerCorrect: boolean | null;
}

// ============ Boss 戰系統（保留原有設計） ============

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  monstersDefeated: number;
  correctAnswers: number;
  wrongAnswers: number;
}

export interface Monster {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  word: string;
  definitions: string[];
  correctDefinitionIndex: number;
}

export interface BossMonster extends Monster {
  spiritId: string; // 對應的精靈 ID
  element: SpiritElement;
}

export interface Player {
  hp: number;
  maxHp: number;
  name: string;
}

export type GameState = "menu" | "playing" | "victory" | "defeat";

export interface BattleRecord {
  odl: string;
  timestamp: number;
  score: number;
  monstersDefeated: number;
  maxCombo: number;
}

// ============ 獎勵系統 ============

export interface GameReward {
  expGained: number;
  newLevel?: number;
  newSpirit?: Spirit;
  isNewHighScore: boolean;
  coinsGained?: number; // 本次獲得金幣
  evolvedSpirit?: { from: Spirit; to: Spirit }; // 本次精靈進化
  isBossVictory?: boolean; // 是否為魔王勝利（金色皇冠慶祝）
}
