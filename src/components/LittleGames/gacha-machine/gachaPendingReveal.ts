import { normalizeGachaSave } from "./gachaLogic";
import {
  isGachaCharacterId,
  type CommittedGachaAttempt,
  type GachaOutcome,
  type GachaSaveV1,
} from "./gachaTypes";
import type { GachaRevealGuard } from "./gachaRevealGuard";

export const GACHA_PENDING_REVEAL_PREFIX =
  "ollie-gacha-machine-pending-reveal-v1:";
export const GACHA_PENDING_REVEAL_COMMITTED_EVENT =
  "ollie-reader:gacha-pending-reveal-committed";

type PendingRevealStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type GachaPendingReveal = {
  schemaVersion: 1;
  uid: string;
  guardToken: string;
  baselineSave: GachaSaveV1;
  outcome: GachaOutcome;
  status: "submitting" | "committed";
  committedAttempt?: CommittedGachaAttempt;
  expiresAt: number;
};

function defaultStorage(): PendingRevealStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutcome(value: unknown): GachaOutcome | null {
  if (!isRecord(value)) return null;
  if (value.kind === "miss") return { kind: "miss" };
  if (value.kind === "character" && isGachaCharacterId(value.characterId)) {
    return { kind: "character", characterId: value.characterId };
  }
  return null;
}

function parseCommittedAttempt(
  value: unknown,
  baselineSave: GachaSaveV1,
  outcome: GachaOutcome,
): CommittedGachaAttempt | null {
  if (
    !isRecord(value) ||
    !isRecord(value.save) ||
    !isRecord(value.result) ||
    typeof value.coinsAfter !== "number" ||
    !Number.isSafeInteger(value.coinsAfter) ||
    value.coinsAfter < 0
  ) {
    return null;
  }

  const save = normalizeGachaSave(value.save);
  const result = value.result;
  if (
    save.resetVersion !== baselineSave.resetVersion ||
    save.totalDraws <= baselineSave.totalDraws ||
    result.totalDraws !== save.totalDraws
  ) {
    return null;
  }

  if (outcome.kind === "miss") {
    if (result.kind !== "miss") return null;
    return {
      save,
      result: { kind: "miss", totalDraws: save.totalDraws },
      coinsAfter: value.coinsAfter,
    };
  }

  if (
    result.kind !== "character" ||
    result.characterId !== outcome.characterId ||
    typeof result.isNew !== "boolean" ||
    typeof result.ownedCount !== "number" ||
    !Number.isSafeInteger(result.ownedCount) ||
    result.ownedCount <= 0 ||
    save.ownedCounts[outcome.characterId] !== result.ownedCount
  ) {
    return null;
  }

  return {
    save,
    result: {
      kind: "character",
      characterId: outcome.characterId,
      isNew: result.isNew,
      ownedCount: result.ownedCount,
      totalDraws: save.totalDraws,
    },
    coinsAfter: value.coinsAfter,
  };
}

export function getGachaPendingRevealKey(uid: string): string {
  return `${GACHA_PENDING_REVEAL_PREFIX}${encodeURIComponent(uid)}`;
}

export function parseGachaPendingReveal(
  raw: string | null,
  expectedUid: string,
  now: number = Date.now(),
): GachaPendingReveal | null {
  if (!raw || !Number.isFinite(now)) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.schemaVersion !== 1 ||
      value.uid !== expectedUid ||
      typeof value.guardToken !== "string" ||
      value.guardToken.length === 0 ||
      !isRecord(value.baselineSave) ||
      (value.status !== "submitting" && value.status !== "committed") ||
      typeof value.expiresAt !== "number" ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    ) {
      return null;
    }

    const baselineSave = normalizeGachaSave(value.baselineSave);
    const outcome = parseOutcome(value.outcome);
    if (!outcome) return null;

    if (value.status === "submitting") {
      return {
        schemaVersion: 1,
        uid: expectedUid,
        guardToken: value.guardToken,
        baselineSave,
        outcome,
        status: "submitting",
        expiresAt: value.expiresAt,
      };
    }

    const committedAttempt = parseCommittedAttempt(
      value.committedAttempt,
      baselineSave,
      outcome,
    );
    if (!committedAttempt) return null;
    return {
      schemaVersion: 1,
      uid: expectedUid,
      guardToken: value.guardToken,
      baselineSave,
      outcome,
      status: "committed",
      committedAttempt,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function readGachaPendingReveal(
  uid: string,
  storage: PendingRevealStorage | null = defaultStorage(),
  now: number = Date.now(),
): GachaPendingReveal | null {
  if (!storage) return null;
  const key = getGachaPendingRevealKey(uid);
  try {
    const pending = parseGachaPendingReveal(storage.getItem(key), uid, now);
    if (!pending) storage.removeItem(key);
    return pending;
  } catch {
    return null;
  }
}

function writePendingReveal(
  pending: GachaPendingReveal,
  storage: PendingRevealStorage | null,
): GachaPendingReveal | null {
  if (!storage) return null;
  const key = getGachaPendingRevealKey(pending.uid);
  try {
    storage.setItem(key, JSON.stringify(pending));
    const stored = parseGachaPendingReveal(
      storage.getItem(key),
      pending.uid,
      Math.min(Date.now(), pending.expiresAt - 1),
    );
    if (!stored || stored.guardToken !== pending.guardToken) {
      storage.removeItem(key);
      return null;
    }
    return stored;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // The server receipt remains authoritative if this best-effort copy fails.
    }
    return null;
  }
}

export function beginGachaPendingReveal(
  uid: string,
  guard: GachaRevealGuard,
  outcome: GachaOutcome,
  storage: PendingRevealStorage | null = defaultStorage(),
): GachaPendingReveal | null {
  if (guard.uid !== uid) return null;
  return writePendingReveal(
    {
      schemaVersion: 1,
      uid,
      guardToken: guard.token,
      baselineSave: normalizeGachaSave(guard.baselineSave),
      outcome,
      status: "submitting",
      expiresAt: guard.expiresAt,
    },
    storage,
  );
}

export function commitGachaPendingReveal(
  pending: GachaPendingReveal,
  committedAttempt: CommittedGachaAttempt,
  storage: PendingRevealStorage | null = defaultStorage(),
): GachaPendingReveal | null {
  const current = readGachaPendingReveal(pending.uid, storage);
  if (
    !current ||
    current.guardToken !== pending.guardToken ||
    current.status !== "submitting"
  ) {
    return null;
  }
  const parsedAttempt = parseCommittedAttempt(
    committedAttempt,
    current.baselineSave,
    current.outcome,
  );
  if (!parsedAttempt) return null;
  return writePendingReveal(
    {
      ...current,
      status: "committed",
      committedAttempt: parsedAttempt,
    },
    storage,
  );
}

export function renewGachaPendingReveal(
  pending: GachaPendingReveal | null,
  guard: GachaRevealGuard,
  storage: PendingRevealStorage | null = defaultStorage(),
): GachaPendingReveal | null {
  if (
    !pending ||
    pending.uid !== guard.uid ||
    pending.guardToken !== guard.token ||
    pending.baselineSave.resetVersion !== guard.baselineSave.resetVersion
  ) {
    return null;
  }
  return writePendingReveal(
    { ...pending, expiresAt: guard.expiresAt },
    storage,
  );
}

export function clearGachaPendingReveal(
  uid: string,
  expectedGuardToken?: string,
  storage: PendingRevealStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  const key = getGachaPendingRevealKey(uid);
  try {
    if (expectedGuardToken) {
      const raw = storage.getItem(key);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (
          isRecord(value) &&
          typeof value.guardToken === "string" &&
          value.guardToken !== expectedGuardToken
        ) {
          return;
        }
      }
    }
    storage.removeItem(key);
  } catch {
    // Clearing the reveal UI must not fail because storage became unavailable.
  }
}
