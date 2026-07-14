import type {
  AppliedGachaDraw,
  GachaCharacterId,
  GachaPhase,
  GachaSaveV1,
} from "./gachaTypes";
import {
  GACHA_CHARACTER_IDS,
  isGachaCharacterId,
} from "./gachaTypes";

export type GachaRng = () => number;

export const EMPTY_GACHA_SAVE: GachaSaveV1 = Object.freeze({
  schemaVersion: 1,
  totalDraws: 0,
  ownedCounts: Object.freeze({}),
});

const PHASE_TRANSITIONS: Record<GachaPhase, readonly GachaPhase[]> = {
  idle: ["coinInserted"],
  coinInserted: ["turning", "idle"],
  turning: ["capsuleReady", "idle"],
  capsuleReady: ["revealed", "idle"],
  revealed: ["idle"],
};

function toNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmptyGachaSave(): GachaSaveV1 {
  return {
    schemaVersion: 1,
    totalDraws: 0,
    ownedCounts: {},
  };
}

export function normalizeGachaSave(value: unknown): GachaSaveV1 {
  if (!isRecord(value)) return createEmptyGachaSave();

  const ownedCounts: Partial<Record<GachaCharacterId, number>> = {};
  const rawOwnedCounts = isRecord(value.ownedCounts) ? value.ownedCounts : {};
  let knownOwnedTotal = 0;

  for (const characterId of GACHA_CHARACTER_IDS) {
    const count = toNonNegativeInteger(rawOwnedCounts[characterId]);
    if (count > 0) {
      ownedCounts[characterId] = count;
      knownOwnedTotal += count;
    }
  }

  return {
    schemaVersion: 1,
    totalDraws: Math.max(
      toNonNegativeInteger(value.totalDraws),
      knownOwnedTotal,
    ),
    ownedCounts,
  };
}

export function pickGachaCharacter(
  rng: GachaRng = Math.random,
): GachaCharacterId {
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError("Gacha RNG must return a number in the range [0, 1).");
  }

  return GACHA_CHARACTER_IDS[Math.floor(roll * GACHA_CHARACTER_IDS.length)];
}

export function canTransitionGachaPhase(
  from: GachaPhase,
  to: GachaPhase,
): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

export function transitionGachaPhase(
  from: GachaPhase,
  to: GachaPhase,
): GachaPhase {
  if (!canTransitionGachaPhase(from, to)) {
    throw new Error(`Invalid gacha phase transition: ${from} -> ${to}`);
  }
  return to;
}

export function applyGachaDraw(
  save: GachaSaveV1,
  characterId: GachaCharacterId,
): AppliedGachaDraw {
  if (!isGachaCharacterId(characterId)) {
    throw new Error(`Unknown gacha character: ${String(characterId)}`);
  }

  const normalized = normalizeGachaSave(save);
  const previousCount = normalized.ownedCounts[characterId] ?? 0;
  const ownedCount = previousCount + 1;
  const totalDraws = normalized.totalDraws + 1;
  const nextSave: GachaSaveV1 = {
    schemaVersion: 1,
    totalDraws,
    ownedCounts: {
      ...normalized.ownedCounts,
      [characterId]: ownedCount,
    },
  };

  return {
    save: nextSave,
    result: {
      characterId,
      isNew: previousCount === 0,
      ownedCount,
      totalDraws,
    },
  };
}
