import type { Spirit, SpiritElement } from "../types/game";
import { getSpiritById } from "../assets/spirits";

type ElementProgress = Partial<Record<SpiritElement, number>>;

interface EvolutionSnapshot {
  unlockedSpiritIds: string[];
  evolvedSpiritIds: string[];
  elementProgress: ElementProgress;
  level?: number;
}

/** 精靈是否已達進化條件 */
export function canEvolve(
  base: Spirit,
  elementProgress: ElementProgress,
  level = 1,
): boolean {
  const cond = base.evolveCondition;
  if (!base.evolvesToId || !cond) return false;
  if (cond.type === "train") {
    return (elementProgress[cond.element] ?? 0) >= cond.correctCount;
  }
  if (cond.type === "level") {
    return level >= cond.level;
  }
  return false;
}

/**
 * 找出「已擁有、條件已達、尚未進化」的第一個可進化精靈。
 * 一次只回傳一個，讓進化演出逐一呈現、且天生冪等（已進化的會被 evolvedSpiritIds 擋掉）。
 */
export function checkPendingEvolution(
  snapshot: EvolutionSnapshot,
): { from: Spirit; to: Spirit } | null {
  for (const id of snapshot.unlockedSpiritIds) {
    if (snapshot.evolvedSpiritIds.includes(id)) continue;
    const base = getSpiritById(id);
    if (!base) continue;
    if (!canEvolve(base, snapshot.elementProgress, snapshot.level ?? 1)) continue;
    const to = base.evolvesToId ? getSpiritById(base.evolvesToId) : undefined;
    if (to) return { from: base, to };
  }
  return null;
}

/** 在本地進度物件上套用一次進化（純函式，冪等） */
export function applyEvolutionLocally<
  T extends { unlockedSpiritIds: string[]; evolvedSpiritIds: string[] },
>(progress: T, fromId: string, toId: string): T {
  return {
    ...progress,
    evolvedSpiritIds: progress.evolvedSpiritIds.includes(fromId)
      ? progress.evolvedSpiritIds
      : [...progress.evolvedSpiritIds, fromId],
    unlockedSpiritIds: progress.unlockedSpiritIds.includes(toId)
      ? progress.unlockedSpiritIds
      : [...progress.unlockedSpiritIds, toId],
  };
}
