import type { PlayerProgress } from "../types/game";
import { STAGES } from "../services/gameProgressService";
import { CHAPTERS } from "./chapters";

// 第 N 章打完 = 走到下一章第一關；最後一章打完 = 走過全部關卡
function chapterCleared(chapterId: string) {
  const index = CHAPTERS.findIndex((c) => c.id === chapterId);
  const next = CHAPTERS[index + 1];
  const end = next ? next.firstStageIndex : STAGES.length;
  return (p: PlayerProgress) => p.currentStageIndex >= end;
}

// Achievement definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: (progress: PlayerProgress) => boolean;
  rarity: "bronze" | "silver" | "gold" | "rainbow";
}

export const ACHIEVEMENTS: Achievement[] = [
  // Level Achievements
  {
    id: "level-2",
    name: "初出茅廬",
    description: "達到等級 2",
    icon: "🌱",
    requirement: (p) => p.level >= 2,
    rarity: "bronze",
  },
  {
    id: "level-5",
    name: "成長中",
    description: "達到等級 5",
    icon: "🌿",
    requirement: (p) => p.level >= 5,
    rarity: "silver",
  },
  {
    id: "level-8",
    name: "實力派",
    description: "達到等級 8",
    icon: "🌳",
    requirement: (p) => p.level >= 8,
    rarity: "gold",
  },
  {
    id: "level-max",
    name: "語言大師",
    description: "達到等級 15",
    icon: "💎",
    requirement: (p) => p.level >= 15,
    rarity: "rainbow",
  },
  {
    id: "level-20",
    name: "單字傳奇",
    description: "達到等級 20",
    icon: "🏆",
    requirement: (p) => p.level >= 20,
    rarity: "rainbow",
  },
  {
    id: "level-25",
    name: "魔法學者",
    description: "達到等級 25",
    icon: "🪄",
    requirement: (p) => p.level >= 25,
    rarity: "rainbow",
  },
  {
    id: "level-30",
    name: "極光探險家",
    description: "達到等級 30",
    icon: "🌌",
    requirement: (p) => p.level >= 30,
    rarity: "rainbow",
  },
  {
    id: "level-35",
    name: "恐龍博士",
    description: "達到等級 35",
    icon: "🦖",
    requirement: (p) => p.level >= 35,
    rarity: "rainbow",
  },
  {
    id: "level-40",
    name: "宇宙單字王",
    description: "達到最高等級 40",
    icon: "🚀",
    requirement: (p) => p.level >= 40,
    rarity: "rainbow",
  },

  // Quiz Achievements
  {
    id: "quiz-10",
    name: "熱身完畢",
    description: "完成 10 次關卡",
    icon: "🎯",
    requirement: (p) => p.totalQuizCompleted >= 10,
    rarity: "bronze",
  },
  {
    id: "quiz-50",
    name: "勤勞學習者",
    description: "完成 50 次關卡",
    icon: "📚",
    requirement: (p) => p.totalQuizCompleted >= 50,
    rarity: "silver",
  },
  {
    id: "quiz-100",
    name: "學霸",
    description: "完成 100 次關卡",
    icon: "🎓",
    requirement: (p) => p.totalQuizCompleted >= 100,
    rarity: "gold",
  },

  // Combo Achievements: a perfect 15-HP boss run ends after 9 answers.
  // Keep the original achievement IDs stable while using reachable thresholds.
  {
    id: "combo-5",
    name: "連擊新手",
    description: "達成 5 連擊",
    icon: "🔥",
    requirement: (p) => p.highestCombo >= 5,
    rarity: "bronze",
  },
  {
    id: "combo-10",
    name: "連擊達人",
    description: "達成 7 連擊",
    icon: "💥",
    requirement: (p) => p.highestCombo >= 7,
    rarity: "silver",
  },
  {
    id: "combo-15",
    name: "連擊大師",
    description: "達成 9 連擊",
    icon: "⚡",
    requirement: (p) => p.highestCombo >= 9,
    rarity: "gold",
  },

  // Boss Achievements
  {
    id: "boss-slayer",
    name: "首勝魔王",
    description: "第一次擊敗魔王",
    icon: "⚔️",
    requirement: (p) => p.totalBossDefeated >= 1,
    rarity: "silver",
  },
  {
    id: "boss-conqueror",
    name: "魔王剋星",
    description: "擊敗所有魔王",
    icon: "👑",
    requirement: (p) => p.totalBossDefeated >= 8,
    rarity: "rainbow",
  },

  // Chapter & Streak Achievements
  {
    id: "chapter2-clear",
    name: "星夢傳說",
    description: "通關雲頂星夢國",
    icon: "🍬",
    requirement: chapterCleared("ch2"),
    rarity: "gold",
  },
  {
    id: "chapter3-clear",
    name: "海底傳說",
    description: "通關珊瑚海底王國",
    icon: "🐋",
    requirement: chapterCleared("ch3"),
    rarity: "rainbow",
  },
  {
    id: "chapter4-clear",
    name: "魔法傳說",
    description: "通關魔法星辰學院",
    icon: "🐉",
    requirement: chapterCleared("ch4"),
    rarity: "rainbow",
  },
  {
    id: "chapter5-clear",
    name: "冰雪傳說",
    description: "通關極光冰雪王國",
    icon: "🧊",
    requirement: chapterCleared("ch5"),
    rarity: "rainbow",
  },
  {
    id: "chapter6-clear",
    name: "恐龍傳說",
    description: "通關恐龍火山島",
    icon: "🌋",
    requirement: chapterCleared("ch6"),
    rarity: "rainbow",
  },
  {
    id: "chapter7-clear",
    name: "銀河傳說",
    description: "通關銀河終點站，完成全部冒險",
    icon: "👑",
    requirement: chapterCleared("ch7"),
    rarity: "rainbow",
  },
  {
    id: "streak-3",
    name: "每天都來玩",
    description: "連續登入 3 天",
    icon: "🔥",
    requirement: (p) => p.streakDays >= 3,
    rarity: "silver",
  },
];

// Rarity styles（含 dark: 變體——淺色用粉彩底＋深色字，深色用半透明色調＋亮色字，
// 避免固定粉彩在深色面板上變成刺眼色塊）
export const RARITY_STYLES = {
  bronze: {
    bg: "from-amber-200 to-orange-200 dark:from-amber-400/25 dark:to-orange-400/15",
    border: "border-amber-400 dark:border-amber-400/40",
    text: "text-amber-700 dark:text-amber-300",
    glow: "shadow-amber-300/50 dark:shadow-amber-500/20",
  },
  silver: {
    bg: "from-slate-200 to-gray-300 dark:from-slate-400/25 dark:to-gray-400/15",
    border: "border-slate-400 dark:border-slate-400/40",
    text: "text-slate-700 dark:text-slate-300",
    glow: "shadow-slate-300/50 dark:shadow-slate-500/20",
  },
  gold: {
    bg: "from-yellow-200 to-amber-300 dark:from-yellow-400/25 dark:to-amber-400/20",
    border: "border-yellow-500 dark:border-yellow-400/50",
    text: "text-yellow-700 dark:text-yellow-300",
    glow: "shadow-yellow-300/50 dark:shadow-yellow-500/25",
  },
  rainbow: {
    bg: "from-pink-200 via-purple-200 to-cyan-200 dark:from-pink-400/25 dark:via-purple-400/25 dark:to-cyan-400/25",
    border: "border-purple-400 dark:border-purple-400/50",
    text: "text-purple-700 dark:text-purple-300",
    glow: "shadow-purple-300/50 dark:shadow-purple-500/25",
  },
};
