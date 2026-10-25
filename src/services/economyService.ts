// ============ 扭蛋代幣規則（coins 為舊存檔欄位名稱） ============

import type { DefLanguage } from "../types/game";

export const COIN_REWARDS = {
  correct: 5, // 每題答對基本代幣
  comboStep: 2, // 每層連擊額外代幣
  comboCap: 8, // 連擊加成上限（避免爆量）
  stageClear: 20, // 過關基本代幣（stage.rewardCoins 未設時）
  bossClearBonus: 40, // 魔王額外代幣
  dailyBase: 20, // 每日獎勵基本代幣
  dailyStreakStep: 5, // 每連續一天額外代幣
  dailyCap: 60, // 每日獎勵上限
  englishModeMultiplier: 2, // 只看英文釋義（難度較高）代幣加倍
} as const;

/** 依本輪釋義語言決定代幣倍率 */
export function coinMultiplierForDefLanguage(lang: DefLanguage): number {
  return lang === "en" ? COIN_REWARDS.englishModeMultiplier : 1;
}

/**
 * 單題答對可得代幣（連擊越高越多，設上限）。
 * 一律四捨五入成整數 — saveProgressWithTokenReward 對非安全整數會丟 RangeError。
 */
export function coinsForAnswer(combo: number, multiplier: number = 1): number {
  const bonus = Math.min(Math.max(combo, 0), COIN_REWARDS.comboCap);
  const base = COIN_REWARDS.correct + bonus * COIN_REWARDS.comboStep;
  return Math.round(base * multiplier);
}

/** 過關可得代幣：優先用關卡設定，否則用公式（魔王加成），最後套上難度倍率 */
export function coinsForStageClear(
  rewardCoins: number | undefined,
  isBoss: boolean,
  multiplier: number = 1,
): number {
  const base =
    typeof rewardCoins === "number"
      ? rewardCoins
      : isBoss
        ? COIN_REWARDS.stageClear + COIN_REWARDS.bossClearBonus
        : COIN_REWARDS.stageClear;
  return Math.round(base * multiplier);
}

// ============ 每日連勝獎勵 ============

export interface DailyBonusResult {
  eligible: boolean; // 今天是否還可領取
  coins: number; // 可領代幣（沿用欄位名稱）
  streakDays: number; // 更新後的連續天數
}

/** 本地時區的 YYYY-MM-DD（避免 UTC 造成跨日誤差） */
export function todayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 把 YYYY-MM-DD 位移天數（本地時區） */
function addDaysLocal(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayLocal(dt);
}

/**
 * 計算每日獎勵。以「上次領取日」判斷連續：
 * - 今天已領 → 不可領
 * - 上次領取是昨天 → 連續 +1
 * - 否則（含第一次）→ 連續重置為 1
 */
export function computeDailyBonus(
  lastClaimDate: string,
  today: string,
  previousStreak: number,
): DailyBonusResult {
  if (lastClaimDate === today) {
    return { eligible: false, coins: 0, streakDays: previousStreak };
  }
  const continued = lastClaimDate === addDaysLocal(today, -1);
  const streakDays = continued ? previousStreak + 1 : 1;
  const coins = Math.min(
    COIN_REWARDS.dailyBase + (streakDays - 1) * COIN_REWARDS.dailyStreakStep,
    COIN_REWARDS.dailyCap,
  );
  return { eligible: true, coins, streakDays };
}

// ============ 單字練習功課獎勵 ============
// 功課比單字大冒險花時間，但每分鐘拿到的代幣刻意比較少：一份常見的功課
// 大約 40～60 代幣，約一次扭蛋；大冒險一關 5 題全對約 65。

export const HOMEWORK_REWARDS = {
  handIn: 20, // 交作業
  dictationCorrect: 3, // 聽寫每寫對一題
  perfect: 10, // 聽寫全對
  firstToday: 10, // 今天第一份功課
  streakStep: 5, // 連續每天寫功課，第 2 天起每天多 5
  streakCap: 20, // 連續天數加成上限
} as const;

export type HomeworkRewardKind = "handIn" | "dictation" | "perfect" | "firstToday" | "streak";

export interface HomeworkRewardItem {
  kind: HomeworkRewardKind;
  coins: number;
  /** Words written right for "dictation"; streak days for "streak". */
  count?: number;
}

export interface HomeworkReward {
  coins: number;
  items: HomeworkRewardItem[];
}

export interface HomeworkStreak {
  /** The local day (YYYY-MM-DD) of the last handed-in homework. */
  lastDay: string;
  days: number;
}

/** Whether a homework handed in `today` is the first of the day, and the streak it makes. */
export function nextHomeworkStreak(
  previous: HomeworkStreak | undefined,
  today: string,
): { firstToday: boolean; days: number } {
  if (previous?.lastDay === today) return { firstToday: false, days: previous.days };
  const continued = previous !== undefined && previous.lastDay === addDaysLocal(today, -1);
  return { firstToday: true, days: continued ? previous.days + 1 : 1 };
}

/**
 * The coins for a handed-in homework. The day's first homework also gets the
 * daily and streak bonuses; later ones only the hand-in and dictation parts.
 * Skipped dictation words count neither way.
 */
export function computeHomeworkReward({
  correctCount,
  total,
  firstToday,
  streakDays,
}: {
  correctCount: number;
  total: number;
  firstToday: boolean;
  streakDays: number;
}): HomeworkReward {
  const items: HomeworkRewardItem[] = [{ kind: "handIn", coins: HOMEWORK_REWARDS.handIn }];
  if (correctCount > 0) {
    items.push({ kind: "dictation", coins: correctCount * HOMEWORK_REWARDS.dictationCorrect, count: correctCount });
  }
  if (total > 0 && correctCount === total) items.push({ kind: "perfect", coins: HOMEWORK_REWARDS.perfect });
  if (firstToday) {
    items.push({ kind: "firstToday", coins: HOMEWORK_REWARDS.firstToday });
    if (streakDays >= 2) {
      const coins = Math.min((streakDays - 1) * HOMEWORK_REWARDS.streakStep, HOMEWORK_REWARDS.streakCap);
      items.push({ kind: "streak", coins, count: streakDays });
    }
  }
  return { coins: items.reduce((sum, item) => sum + item.coins, 0), items };
}
