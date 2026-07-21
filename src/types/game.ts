export interface PlayerProgress {
  odl: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  currentStageIndex: number;
  totalQuizCompleted: number;
  totalBossDefeated: number;
  highestCombo: number;
  resetVersion: number;
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
  bossHp?: number; // Boss 戰專用
  questionCount: number; // 普通關卡題數
  chapterId?: string; // 所屬章節（undefined = 第一章）
  questionKinds?: QuizKind[]; // 本關題型組合（undefined = 全部 "meaning"）
  rewardCoins?: number; // 過關代幣（undefined = 用公式推算）
}

export type GameView = "home" | "map" | "quiz" | "boss" | "reward";

// 題型判別子
export type QuizKind = "meaning" | "listen" | "spell" | "reverse" | "emoji";

interface BaseQuestion {
  kind: QuizKind;
  word: string; // 正解英文單字
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
  isNewHighScore: boolean;
  coinsGained?: number; // 本次獲得扭蛋代幣（沿用欄位名稱）
  tokenSyncFailed?: boolean; // 代幣未成功寫入時顯示明確提示
  isBossVictory?: boolean; // 是否為魔王勝利（金色皇冠慶祝）
}
