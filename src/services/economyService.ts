// ============ 金幣規則 ============

export const COIN_REWARDS = {
  correct: 5, // 每題答對基本金幣
  comboStep: 2, // 每層連擊額外金幣
  comboCap: 8, // 連擊加成上限（避免爆量）
  stageClear: 20, // 過關基本金幣（stage.rewardCoins 未設時）
  bossClearBonus: 40, // 魔王額外金幣
  dailyBase: 20, // 每日獎勵基本金幣
  dailyStreakStep: 5, // 每連續一天額外金幣
  dailyCap: 60, // 每日獎勵上限
} as const;

/** 單題答對可得金幣（連擊越高越多，設上限） */
export function coinsForAnswer(combo: number): number {
  const bonus = Math.min(Math.max(combo, 0), COIN_REWARDS.comboCap);
  return COIN_REWARDS.correct + bonus * COIN_REWARDS.comboStep;
}

/** 過關可得金幣：優先用關卡設定，否則用公式（魔王加成） */
export function coinsForStageClear(
  rewardCoins: number | undefined,
  isBoss: boolean,
): number {
  if (typeof rewardCoins === "number") return rewardCoins;
  return isBoss
    ? COIN_REWARDS.stageClear + COIN_REWARDS.bossClearBonus
    : COIN_REWARDS.stageClear;
}

// ============ 每日連勝獎勵 ============

export interface DailyBonusResult {
  eligible: boolean; // 今天是否還可領取
  coins: number; // 可領金幣
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
