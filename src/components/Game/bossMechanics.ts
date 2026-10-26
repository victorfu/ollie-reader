import type { BossState, Stage } from "../../types/game";

// 連錯幾題魔王張護盾
export const SHIELD_WRONG_STREAK = 2;

/** 開戰時的魔王狀態 */
export function initialBossState(stage: Stage, hp: number): BossState {
  return {
    bossHp: hp,
    bossMaxHp: hp,
    lastHit: null,
    phase: 0,
    phaseCount: Math.max(1, stage.bossPhases?.length ?? 1),
    enteredPhase: false,
    shielded: false,
    wrongStreak: 0,
  };
}

/**
 * HP 依階段數平均切段：3 階段、HP 9 → 9–7 第一階段、6–4 第二、3–1 第三。
 * 一次爆擊可能跨過一整段，直接跳到對應階段。
 */
export function bossPhaseForHp(
  hp: number,
  maxHp: number,
  phaseCount: number,
): number {
  if (phaseCount <= 1 || maxHp <= 0) return 0;
  const lost = Math.min(maxHp, Math.max(0, maxHp - hp));
  return Math.min(phaseCount - 1, Math.floor((lost * phaseCount) / maxHp));
}

/**
 * 依作答結果算出下一個魔王狀態（純函式，useAdventure 與測試共用）。
 * - 答對：護盾中只破盾不扣血；否則扣 1，連擊 ≥3 爆擊扣 2
 * - 答錯／逾時：累計連錯，開了護盾機制的魔王連錯 SHIELD_WRONG_STREAK 題張護盾
 * newCombo 是這題作答後的連擊數。
 */
export function nextBossState(
  boss: BossState,
  isCorrect: boolean,
  newCombo: number,
  shieldEnabled: boolean,
): BossState {
  if (!isCorrect) {
    const wrongStreak = boss.wrongStreak + 1;
    return {
      ...boss,
      lastHit: "player",
      enteredPhase: false,
      wrongStreak,
      shielded:
        boss.shielded || (shieldEnabled && wrongStreak >= SHIELD_WRONG_STREAK),
    };
  }
  if (boss.shielded) {
    return {
      ...boss,
      lastHit: "shield",
      enteredPhase: false,
      shielded: false,
      wrongStreak: 0,
    };
  }
  const damage = newCombo >= 3 ? 2 : 1;
  const bossHp = Math.max(0, boss.bossHp - damage);
  const phase = Math.max(
    boss.phase,
    bossPhaseForHp(bossHp, boss.bossMaxHp, boss.phaseCount),
  );
  return {
    ...boss,
    bossHp,
    lastHit: "boss",
    wrongStreak: 0,
    phase,
    enteredPhase: phase > boss.phase,
  };
}
