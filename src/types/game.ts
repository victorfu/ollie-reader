// ============ 精靈收集系統 ============

export type SpiritElement = "fire" | "water" | "grass" | "electric" | "normal";
export type SpiritRarity = "common" | "uncommon" | "rare" | "legendary";

export interface Spirit {
  id: string;
  name: string;
  element: SpiritElement;
  rarity: SpiritRarity;
  description: string;
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
}

export type GameView =
  | "home"
  | "map"
  | "quiz"
  | "boss"
  | "collection"
  | "reward";

export interface QuizQuestion {
  word: string;
  phonetic?: string;
  options: string[]; // 4 個選項
  correctIndex: number;
  spiritId?: string; // 這題對應的精靈
}

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
}
