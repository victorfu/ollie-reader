import type {
  AppliedGachaAttempt,
  GachaCharacterId,
  GachaOutcome,
  GachaPhase,
  GachaSaveV1,
} from "./gachaTypes";
import {
  GACHA_CHARACTER_IDS,
  isGachaCharacterId,
} from "./gachaTypes";

export type GachaRng = () => number;

export const MISS_RATE = 0.2;

export const EMPTY_GACHA_SAVE: GachaSaveV1 = Object.freeze({
  schemaVersion: 1,
  resetVersion: 0,
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
    resetVersion: 0,
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
    resetVersion: toNonNegativeInteger(value.resetVersion),
    totalDraws: Math.max(
      toNonNegativeInteger(value.totalDraws),
      knownOwnedTotal,
    ),
    ownedCounts,
  };
}

export function assertGachaOutcome(
  outcome: unknown,
): asserts outcome is GachaOutcome {
  if (!isRecord(outcome)) {
    throw new Error("Invalid gacha outcome.");
  }
  if (outcome.kind === "miss") return;
  if (
    outcome.kind === "character"
    && isGachaCharacterId(outcome.characterId)
  ) {
    return;
  }
  throw new Error("Invalid gacha outcome.");
}

export function pickGachaOutcome(
  rng: GachaRng = Math.random,
): GachaOutcome {
  const roll = rng();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError("Gacha RNG must return a number in the range [0, 1).");
  }

  if (roll < MISS_RATE) return { kind: "miss" };

  const hitRoll = (roll - MISS_RATE) / (1 - MISS_RATE);
  const characterIndex = Math.min(
    GACHA_CHARACTER_IDS.length - 1,
    Math.floor(hitRoll * GACHA_CHARACTER_IDS.length),
  );
  return {
    kind: "character",
    characterId: GACHA_CHARACTER_IDS[characterIndex],
  };
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

export function applyGachaAttempt(
  save: GachaSaveV1,
  outcome: GachaOutcome,
): AppliedGachaAttempt {
  assertGachaOutcome(outcome);

  const normalized = normalizeGachaSave(save);
  const totalDraws = normalized.totalDraws + 1;

  if (outcome.kind === "miss") {
    return {
      save: {
        ...normalized,
        totalDraws,
      },
      result: {
        kind: "miss",
        totalDraws,
      },
    };
  }

  const previousCount = normalized.ownedCounts[outcome.characterId] ?? 0;
  const ownedCount = previousCount + 1;
  const nextSave: GachaSaveV1 = {
    ...normalized,
    totalDraws,
    ownedCounts: {
      ...normalized.ownedCounts,
      [outcome.characterId]: ownedCount,
    },
  };

  return {
    save: nextSave,
    result: {
      kind: "character",
      characterId: outcome.characterId,
      isNew: previousCount === 0,
      ownedCount,
      totalDraws,
    },
  };
}
