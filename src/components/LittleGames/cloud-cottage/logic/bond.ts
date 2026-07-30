import {
  BOND_LEVEL_THRESHOLDS,
  BOND_LEVEL_TITLES,
  BOND_UNLOCKS,
  DAILY_BOND_CAP,
  MAX_BOND_LEVEL,
  MISSED_VISIT_AFTER_MS,
  MISSED_VISIT_BOND,
} from "../constants";
import type { BondUnlock, LocalDate, PetBond } from "../types";

export type BondAwardResult = {
  bond: PetBond;
  requested: number;
  awarded: number;
  capReached: boolean;
};

export type BondProgress = {
  level: number;
  titleZh: string;
  titleEn: string;
  currentThreshold: number;
  nextThreshold: number | null;
  earnedInLevel: number;
  neededForNext: number;
  ratio: number;
  isMaxLevel: boolean;
};

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Awards as much as still fits today; a 38 + 6 award therefore grants 2. */
export function awardBond(
  current: PetBond,
  requestedAmount: number,
  localDate: LocalDate,
): BondAwardResult {
  const requested = toNonNegativeInteger(requestedAmount);
  const sameDay = current.earnedDate === localDate;
  const storedDateIsFuture = current.earnedDate > localDate;
  const earnedToday = sameDay || storedDateIsFuture
    ? Math.min(DAILY_BOND_CAP, toNonNegativeInteger(current.earnedToday))
    : 0;
  const awarded = Math.min(requested, DAILY_BOND_CAP - earnedToday);
  const nextEarnedToday = earnedToday + awarded;
  const unchanged =
    awarded === 0 &&
    (sameDay || storedDateIsFuture) &&
    current.earnedToday === earnedToday &&
    Number.isFinite(current.total) &&
    current.total >= 0;

  return {
    bond: unchanged
      ? current
      : {
          total: toNonNegativeInteger(current.total) + awarded,
          earnedToday: nextEarnedToday,
          earnedDate: storedDateIsFuture ? current.earnedDate : localDate,
        },
    requested,
    awarded,
    capReached: nextEarnedToday >= DAILY_BOND_CAP || awarded < requested,
  };
}

export function getBondLevel(totalBond: number): number {
  const total = toNonNegativeInteger(totalBond);
  for (let index = BOND_LEVEL_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (total >= BOND_LEVEL_THRESHOLDS[index]) return index + 1;
  }
  return 1;
}

export function getBondProgress(totalBond: number): BondProgress {
  const total = toNonNegativeInteger(totalBond);
  const level = getBondLevel(total);
  const currentThreshold = BOND_LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = BOND_LEVEL_THRESHOLDS[level] ?? null;
  const title = [...BOND_LEVEL_TITLES]
    .reverse()
    .find((candidate) => candidate.level <= level) ?? BOND_LEVEL_TITLES[0];
  const earnedInLevel = total - currentThreshold;
  const neededForNext = nextThreshold === null ? 0 : nextThreshold - total;
  const ratio =
    nextThreshold === null
      ? 1
      : Math.min(1, earnedInLevel / (nextThreshold - currentThreshold));

  return {
    level,
    titleZh: title.nameZh,
    titleEn: title.nameEn,
    currentThreshold,
    nextThreshold,
    earnedInLevel,
    neededForNext,
    ratio,
    isMaxLevel: level === MAX_BOND_LEVEL,
  };
}

export function getUnlocksAtLevel(
  level: number,
  phase?: 1 | 2,
): BondUnlock[] {
  return BOND_UNLOCKS.filter(
    (unlock) => unlock.level === level && (phase === undefined || unlock.phase === phase),
  );
}

export function getUnlockedContent(
  level: number,
  phase?: 1 | 2,
): BondUnlock[] {
  return BOND_UNLOCKS.filter(
    (unlock) => unlock.level <= level && (phase === undefined || unlock.phase === phase),
  );
}

export function getNewBondUnlocks(
  previousTotal: number,
  nextTotal: number,
  phase?: 1 | 2,
): BondUnlock[] {
  const previousLevel = getBondLevel(previousTotal);
  const nextLevel = getBondLevel(nextTotal);
  if (nextLevel <= previousLevel) return [];
  return BOND_UNLOCKS.filter(
    (unlock) =>
      unlock.level > previousLevel &&
      unlock.level <= nextLevel &&
      (phase === undefined || unlock.phase === phase),
  );
}

export function isMissedVisit(lastVisitAt: number, now: number): boolean {
  return (
    Number.isFinite(lastVisitAt) &&
    lastVisitAt > 0 &&
    Math.max(0, now - lastVisitAt) >= MISSED_VISIT_AFTER_MS
  );
}

/**
 * Returns the visit patch and bond result together so callers cannot forget to
 * advance lastVisitAt after granting the one-time welcome-back bonus.
 */
export function applyMissedVisitBonus(
  bond: PetBond,
  lastVisitAt: number,
  now: number,
  localDate: LocalDate,
): BondAwardResult & { lastVisitAt: number; missed: boolean } {
  const missed = isMissedVisit(lastVisitAt, now);
  const result = awardBond(bond, missed ? MISSED_VISIT_BOND : 0, localDate);
  return { ...result, lastVisitAt: Math.max(lastVisitAt, now), missed };
}
