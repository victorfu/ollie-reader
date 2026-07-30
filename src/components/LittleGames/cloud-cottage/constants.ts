import type { BondUnlock } from "./types";

export const HOUR_MS = 60 * 60 * 1_000;
export const DAY_MS = 24 * HOUR_MS;

export const STAT_MAX = 100;
export const INITIAL_STATS = {
  fullness: 70,
  clean: 75,
  mood: 85,
} as const;

export const STAT_DECAY = {
  fullness: { points: 80, durationMs: 24 * HOUR_MS, floor: 20 },
  clean: { points: 70, durationMs: 72 * HOUR_MS, floor: 30 },
  mood: { points: 40, durationMs: 12 * HOUR_MS, floor: 60 },
} as const;

export const FULLNESS_REFUSAL_THRESHOLD = 90;
export const CLEAN_BOND_THRESHOLD = 90;
export const FREE_FOOD_DAILY_STOCK = 2;
export const DAILY_BOND_CAP = 40;
export const MISSED_VISIT_AFTER_MS = 48 * HOUR_MS;
export const MISSED_VISIT_BOND = 10;
export const WISH_BOND_REWARD = 10;
export const SLEEP_BOND_REWARD = 4;
export const SLEEP_START_HOUR = 19;
export const SLEEP_END_HOUR = 7;

/** Total bond required to be at each level, indexed by level - 1. */
export const BOND_LEVEL_THRESHOLDS = [
  0,
  20,
  50,
  90,
  140,
  200,
  270,
  350,
  440,
  540,
  650,
  770,
  900,
  1_040,
  1_190,
  1_350,
  1_520,
  1_700,
  1_890,
  2_090,
] as const;

export const MAX_BOND_LEVEL = BOND_LEVEL_THRESHOLDS.length;

export const BOND_LEVEL_TITLES = [
  { level: 1, nameZh: "剛認識的朋友", nameEn: "New Friend" },
  { level: 5, nameZh: "好朋友", nameEn: "Good Friend" },
  { level: 10, nameZh: "麻吉好朋友", nameEn: "Best Buddy" },
  { level: 15, nameZh: "最好的朋友", nameEn: "Best Friend" },
  { level: 20, nameZh: "最重要的家人", nameEn: "Family Forever" },
] as const;

export const BOND_UNLOCKS: readonly BondUnlock[] = [
  { level: 2, type: "phrase", id: "love-it", nameZh: "我好喜歡！", nameEn: "I love it!", phase: 1 },
  { level: 3, type: "action", id: "spin", nameZh: "轉圈圈", nameEn: "Spin", phase: 1 },
  { level: 4, type: "phrase", id: "you-are-the-best", nameZh: "你最棒了！", nameEn: "You're the best!", phase: 1 },
  { level: 5, type: "gift", id: "flower-gift", nameZh: "一朵小花", nameEn: "Little Flower", phase: 2 },
  { level: 6, type: "action", id: "happy-dance", nameZh: "開心跳舞", nameEn: "Happy Dance", phase: 1 },
  { level: 7, type: "phrase", id: "lets-play", nameZh: "一起玩吧！", nameEn: "Let's play!", phase: 1 },
  { level: 8, type: "gift", id: "clover-plant", nameZh: "幸運草盆栽", nameEn: "Lucky Clover", phase: 2 },
  { level: 9, type: "action", id: "roll-over", nameZh: "撒嬌打滾", nameEn: "Roll Over", phase: 1 },
  { level: 10, type: "phrase", id: "so-happy", nameZh: "我好開心！", nameEn: "I'm so happy!", phase: 1 },
  { level: 11, type: "gift", id: "star-hanging", nameZh: "星星掛飾", nameEn: "Star Hanging", phase: 2 },
  { level: 12, type: "action", id: "ear-flight", nameZh: "大耳朵飛行", nameEn: "Ear Flight", phase: 1 },
  { level: 13, type: "phrase", id: "sweet-dreams", nameZh: "甜甜的夢！", nameEn: "Sweet dreams!", phase: 1 },
  { level: 14, type: "gift", id: "rainbow-picture", nameZh: "彩虹掛畫", nameEn: "Rainbow Picture", phase: 2 },
  { level: 15, type: "gift", id: "golden-bow", nameZh: "金色蝴蝶結", nameEn: "Golden Bow", phase: 2 },
  { level: 16, type: "action", id: "cloud-bounce", nameZh: "雲朵彈跳", nameEn: "Cloud Bounce", phase: 1 },
  { level: 17, type: "phrase", id: "best-friends-forever", nameZh: "永遠都是最好的朋友！", nameEn: "Best friends forever!", phase: 1 },
  { level: 18, type: "gift", id: "cloud-frame", nameZh: "雲朵相框", nameEn: "Cloud Frame", phase: 2 },
  { level: 19, type: "phrase", id: "love-you", nameZh: "我愛你！", nameEn: "I love you!", phase: 1 },
  { level: 20, type: "celebration", id: "family-celebration", nameZh: "家人慶典", nameEn: "Family Celebration", phase: 1 },
] as const;
