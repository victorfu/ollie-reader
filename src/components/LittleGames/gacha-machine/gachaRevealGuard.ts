import { normalizeGachaSave } from "./gachaLogic";
import type { GachaSaveV1 } from "./gachaTypes";

export const GACHA_REVEAL_GUARD_PREFIX =
  "ollie-gacha-machine-reveal-guard-v1:";
export const GACHA_REVEAL_GUARD_TTL_MS = 10 * 60 * 1000;
export const GACHA_REVEAL_GUARD_HEARTBEAT_MS =
  Math.floor(GACHA_REVEAL_GUARD_TTL_MS / 3);

export type GachaRevealGuard = {
  schemaVersion: 1;
  uid: string;
  token: string;
  baselineSave: GachaSaveV1;
  expiresAt: number;
};

type RevealGuardStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

function defaultStorage(): RevealGuardStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getGachaRevealGuardKeyPrefix(uid: string): string {
  return `${GACHA_REVEAL_GUARD_PREFIX}${encodeURIComponent(uid)}:`;
}

export function getGachaRevealGuardKey(guard: GachaRevealGuard): string {
  return `${getGachaRevealGuardKeyPrefix(guard.uid)}${guard.token}`;
}

export function parseGachaRevealGuard(
  raw: string | null,
  expectedUid?: string,
): GachaRevealGuard | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.schemaVersion !== 1 ||
      typeof value.uid !== "string" ||
      value.uid.length === 0 ||
      (expectedUid !== undefined && value.uid !== expectedUid) ||
      typeof value.token !== "string" ||
      value.token.length === 0 ||
      !isRecord(value.baselineSave) ||
      typeof value.expiresAt !== "number" ||
      !Number.isFinite(value.expiresAt)
    ) {
      return null;
    }
    const baselineSave = normalizeGachaSave(value.baselineSave);
    return {
      schemaVersion: 1,
      uid: value.uid,
      token: value.token,
      baselineSave,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

export function beginGachaRevealGuard(
  uid: string,
  baselineSave: GachaSaveV1,
  storage: RevealGuardStorage | null = defaultStorage(),
  now: number = Date.now(),
  token: string = createToken(),
): GachaRevealGuard | null {
  if (
    uid.length === 0 ||
    !Number.isFinite(now) ||
    !storage
  ) {
    return null;
  }
  const guard: GachaRevealGuard = {
    schemaVersion: 1,
    uid,
    token,
    baselineSave: normalizeGachaSave(baselineSave),
    expiresAt: now + GACHA_REVEAL_GUARD_TTL_MS,
  };
  const key = getGachaRevealGuardKey(guard);
  try {
    storage.setItem(key, JSON.stringify(guard));
    const stored = parseGachaRevealGuard(storage.getItem(key), uid);
    if (!stored || stored.token !== token) {
      storage.removeItem(key);
      return null;
    }
    return stored;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // The original storage failure is enough to reject the guarded draw.
    }
    return null;
  }
}

export function endGachaRevealGuard(
  guard: GachaRevealGuard | null,
  storage: RevealGuardStorage | null = defaultStorage(),
): void {
  if (!guard || !storage) return;
  try {
    storage.removeItem(getGachaRevealGuardKey(guard));
  } catch {
    // The reveal itself must keep working when storage becomes unavailable.
  }
}

export function renewGachaRevealGuard(
  guard: GachaRevealGuard | null,
  storage: RevealGuardStorage | null = defaultStorage(),
  now: number = Date.now(),
): GachaRevealGuard | null {
  if (!guard || !storage || !Number.isFinite(now)) return null;
  try {
    const key = getGachaRevealGuardKey(guard);
    const stored = parseGachaRevealGuard(storage.getItem(key), guard.uid);
    if (!stored || stored.token !== guard.token) return null;
    const renewed: GachaRevealGuard = {
      ...stored,
      expiresAt: now + GACHA_REVEAL_GUARD_TTL_MS,
    };
    storage.setItem(key, JSON.stringify(renewed));
    return renewed;
  } catch {
    return null;
  }
}

export function listActiveGachaRevealGuards(
  uid: string,
  storage: RevealGuardStorage | null = defaultStorage(),
  now: number = Date.now(),
): GachaRevealGuard[] {
  if (!storage) return [];
  const prefix = getGachaRevealGuardKeyPrefix(uid);
  const guards: GachaRevealGuard[] = [];
  const expiredKeys: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const guard = parseGachaRevealGuard(storage.getItem(key), uid);
      if (
        !guard ||
        guard.expiresAt <= now ||
        guard.expiresAt > now + GACHA_REVEAL_GUARD_TTL_MS
      ) {
        expiredKeys.push(key);
      } else {
        guards.push(guard);
      }
    }
    for (const key of expiredKeys) storage.removeItem(key);
  } catch {
    return guards;
  }

  return guards;
}

export function clearGachaRevealGuards(
  uid: string,
  storage: RevealGuardStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  const prefix = getGachaRevealGuardKeyPrefix(uid);
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // A collection reset is still valid if local guard cleanup is unavailable.
  }
}

export function isGachaSaveGuarded(
  save: GachaSaveV1,
  guards: readonly GachaRevealGuard[],
  now: number = Date.now(),
): boolean {
  return guards.some(
    (guard) =>
      guard.expiresAt > now &&
      guard.baselineSave.resetVersion === save.resetVersion &&
      save.totalDraws > guard.baselineSave.totalDraws,
  );
}

export function getGachaSaveBeforeGuards(
  incoming: GachaSaveV1,
  guards: readonly GachaRevealGuard[],
  now: number = Date.now(),
): GachaSaveV1 | null {
  let oldestBaseline: GachaSaveV1 | null = null;
  for (const guard of guards) {
    if (
      guard.expiresAt <= now ||
      guard.baselineSave.resetVersion !== incoming.resetVersion ||
      incoming.totalDraws <= guard.baselineSave.totalDraws
    ) {
      continue;
    }
    if (
      !oldestBaseline ||
      guard.baselineSave.totalDraws < oldestBaseline.totalDraws
    ) {
      oldestBaseline = guard.baselineSave;
    }
  }
  return oldestBaseline;
}
