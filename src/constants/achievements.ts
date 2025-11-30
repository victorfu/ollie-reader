import type { PlayerProgress } from "../types/game";

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
    requirement: (p) => p.unlockedSpiritIds.length >= 14,
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
    description: "達到最高等級",
    icon: "💎",
    requirement: (p) => p.level >= 10,
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
];

// Rarity styles
export const RARITY_STYLES = {
  bronze: {
    bg: "from-amber-200 to-orange-200",
    border: "border-amber-400",
    text: "text-amber-700",
    glow: "shadow-amber-300/50",
  },
  silver: {
    bg: "from-slate-200 to-gray-300",
    border: "border-slate-400",
    text: "text-slate-700",
    glow: "shadow-slate-300/50",
  },
  gold: {
    bg: "from-yellow-200 to-amber-300",
    border: "border-yellow-500",
    text: "text-yellow-700",
    glow: "shadow-yellow-300/50",
  },
  rainbow: {
    bg: "from-pink-200 via-purple-200 to-cyan-200",
    border: "border-purple-400",
    text: "text-purple-700",
    glow: "shadow-purple-300/50",
  },
};
