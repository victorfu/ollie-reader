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
  lastLoginDate: string; // Asia/Taipei 的 YYYY-MM-DD（由 server time 推導）
  lastDailyClaimDate: string; // 同上（每日獎勵冪等用）
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
  // 多階段魔王：每階段的題型組合，HP 依階段數平均切段（undefined = 單一階段，用 questionKinds）
  bossPhases?: QuizKind[][];
  bossShield?: boolean; // 連錯 2 題魔王張護盾，下一題答對只破盾不扣血
}

export type GameView = "home" | "map" | "quiz" | "boss" | "reward";

// 題型判別子
export type QuizKind =
  | "meaning"
  | "listen"
  | "spell"
  | "reverse"
  | "emoji"
  | "cloze"
  | "dictation"
  | "synonym"
  | "pos"
  | "order"
  | "typing"
  | "listenCloze";

// 詞性題的四個選項（固定順序，小朋友比較好找）
export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb";

// 題目釋義語言：zh=中文釋義 · en=英文釋義（英英，難度較高，代幣加倍）
export type DefLanguage = "zh" | "en";

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
// dictation=聽音拼字：只播發音，hint 等作答後才揭曉
export interface SpellQuestion extends BaseQuestion {
  kind: "spell" | "dictation";
  letters: string[]; // 打散後的字母 chips
  hint: string; // 中文提示（該字的意思）
}

// 鍵盤拼字：看釋義直接打出單字（不給字母塊）
export interface TypingQuestion extends BaseQuestion {
  kind: "typing";
  hint: string; // 該字的釋義（本輪語言）
}

// 同反義：選出與題目單字意思相同（same）或相反（opposite）的英文字
export interface SynonymQuestion extends BaseQuestion {
  kind: "synonym";
  relation: "same" | "opposite";
  options: string[]; // 4 個英文字
  correctIndex: number;
}

// 詞性判斷：options 固定為四種詞性，畫面再翻成「名詞 noun」等標籤
export interface PosQuestion extends BaseQuestion {
  kind: "pos";
  hint: string; // 該字的釋義，幫忙判斷詞性
  options: PartOfSpeech[];
  correctIndex: number;
}

// 句子排序：例句拆成單字塊，依序點回原句
export interface OrderQuestion extends BaseQuestion {
  kind: "order";
  tokens: string[]; // 打散後的單字塊（標點黏在字上）
  sentence: string; // 原句（正解）
  translation?: string; // 例句中文翻譯（可能沒有）
}

// 句子填空：例句挖掉被考的字，四選一選出原形單字
// listenCloze=聽句填空：進場先唸整句，不顯示釋義提示
export interface ClozeQuestion extends BaseQuestion {
  kind: "cloze" | "listenCloze";
  prompt: string; // 挖空後的例句
  hint: string; // 該字的釋義（本輪語言）— 例句常有好幾個字說得通，作答前用它點出要的字
  options: string[]; // 4 個英文單字（原形）
  correctIndex: number;
  sentence: string; // 原句，答完揭曉用
  translation?: string; // 例句中文翻譯（可能沒有）
}

export type QuizQuestion =
  | OptionQuestion
  | SpellQuestion
  | ClozeQuestion
  | TypingQuestion
  | SynonymQuestion
  | PosQuestion
  | OrderQuestion;

export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  timeLeft: number;
  lives: number;
  maxLives: number;
  score: number;
  combo: number;
  maxCombo: number;
  isAnswered: boolean;
  lastAnswerCorrect: boolean | null;
}

// ============ Boss 戰系統（保留原有設計） ============

export interface BossState {
  bossHp: number;
  bossMaxHp: number;
  // 最近一次是誰被打（給 UI 做 shake）；shield=這題答對只打破了護盾
  lastHit: "player" | "boss" | "shield" | null;
  phase: number; // 目前階段（0 起算）
  phaseCount: number; // 總階段數（單一階段魔王 = 1）
  enteredPhase: boolean; // 這一題的攻擊讓魔王進入新階段（UI 提示用）
  shielded: boolean; // 護盾中：下一題答對只破盾不扣血
  wrongStreak: number; // 連續答錯／逾時次數（答對歸零）
}

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
  defLanguage?: DefLanguage; // 本輪釋義語言（英文模式顯示加倍徽章）
  tokenSyncFailed?: boolean; // 代幣未成功寫入時顯示明確提示
  isBossVictory?: boolean; // 是否為魔王勝利（金色皇冠慶祝）
}
