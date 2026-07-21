import type { PlayerProgress } from "../types/game";
import { SPIRITS } from "../assets/spirits";
import { STAGES } from "../services/gameProgressService";

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
  // Spirit Collection Achievements
  {
    id: "first-spirit",
    name: "初次相遇",
    description: "收集第一隻精靈",
    icon: "🌟",
    requirement: (p) => p.unlockedSpiritIds.length >= 1,
    rarity: "bronze",
  },
  {
    id: "spirit-collector",
    name: "精靈收藏家",
    description: "收集 5 隻精靈",
    icon: "✨",
    requirement: (p) => p.unlockedSpiritIds.length >= 5,
    rarity: "silver",
  },
  {
    id: "spirit-master",
    name: "精靈大師",
    description: "收集 10 隻精靈",
    icon: "👑",
    requirement: (p) => p.unlockedSpiritIds.length >= 10,
    rarity: "gold",
  },
  {
    id: "spirit-legend",
    name: "傳說收藏家",
    description: "收集所有精靈",
    icon: "🏆",
    // 逐一比對而非比數量：舊存檔可能含已下架的扭蛋限定精靈 id
    requirement: (p) => SPIRITS.every((s) => p.unlockedSpiritIds.includes(s.id)),
    rarity: "rainbow",
  },

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
    description: "達到最高等級 15",
    icon: "💎",
    requirement: (p) => p.level >= 15,
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

  // Combo Achievements
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
    description: "達成 10 連擊",
    icon: "💥",
    requirement: (p) => p.highestCombo >= 10,
    rarity: "silver",
  },
  {
    id: "combo-15",
    name: "連擊大師",
    description: "達成 15 連擊",
    icon: "⚡",
    requirement: (p) => p.highestCombo >= 15,
    rarity: "gold",
  },

  // Evolution Achievements
  {
    id: "first-evolution",
    name: "初次進化",
    description: "讓一隻精靈進化",
    icon: "🦋",
    requirement: (p) => p.evolvedSpiritIds.length >= 1,
    rarity: "silver",
  },
  {
    id: "evolution-master",
    name: "進化大師",
    description: "讓 3 隻精靈進化",
    icon: "🌈",
    requirement: (p) => p.evolvedSpiritIds.length >= 3,
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
    requirement: (p) => p.currentStageIndex >= STAGES.length,
    rarity: "gold",
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
