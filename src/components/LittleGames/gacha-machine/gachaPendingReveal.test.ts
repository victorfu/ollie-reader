import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginGachaPendingReveal,
  clearGachaPendingReveal,
  commitGachaPendingReveal,
  getGachaPendingRevealKey,
  readGachaPendingReveal,
  renewGachaPendingReveal,
} from "./gachaPendingReveal";
import {
  GACHA_REVEAL_GUARD_HEARTBEAT_MS,
  beginGachaRevealGuard,
  renewGachaRevealGuard,
} from "./gachaRevealGuard";

const BASELINE = {
  schemaVersion: 1 as const,
  resetVersion: 2,
  totalDraws: 4,
  ownedCounts: { kuromi: 1 },
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-12T08:00:00.000Z"));
  localStorage.clear();
  sessionStorage.clear();
});

describe("gacha pending reveal recovery", () => {
  it("durably restores a committed miss without exposing it to another tab", () => {
    const firstTab = createMemoryStorage();
    const secondTab = createMemoryStorage();
    const guard = beginGachaRevealGuard(
      "player-1",
      BASELINE,
      localStorage,
      Date.now(),
      "miss-draw",
    );
    if (!guard) throw new Error("guard was not created");

    const submitting = beginGachaPendingReveal(
      "player-1",
      guard,
      { kind: "miss" },
      firstTab,
    );
    if (!submitting) throw new Error("pending reveal was not created");
    const committed = commitGachaPendingReveal(
      submitting,
      {
        coinsAfter: 150,
        save: { ...BASELINE, totalDraws: 5 },
        result: { kind: "miss", totalDraws: 5 },
      },
      firstTab,
    );

    expect(committed?.status).toBe("committed");
    expect(
      readGachaPendingReveal("player-1", firstTab)?.committedAttempt?.result,
    ).toEqual({ kind: "miss", totalDraws: 5 });
    expect(readGachaPendingReveal("player-1", secondTab)).toBeNull();
  });

  it("keeps uid and guard-token ownership isolated when clearing", () => {
    const storage = createMemoryStorage();
    const guard = beginGachaRevealGuard(
      "player-a",
      BASELINE,
      localStorage,
      Date.now(),
      "owned-token",
    );
    if (!guard) throw new Error("guard was not created");
    expect(
      beginGachaPendingReveal(
        "player-a",
        guard,
        { kind: "character", characterId: "hello-kitty" },
        storage,
      ),
    ).not.toBeNull();

    expect(readGachaPendingReveal("player-b", storage)).toBeNull();
    clearGachaPendingReveal("player-a", "different-token", storage);
    expect(readGachaPendingReveal("player-a", storage)).not.toBeNull();
    clearGachaPendingReveal("player-a", "owned-token", storage);
    expect(readGachaPendingReveal("player-a", storage)).toBeNull();
  });

  it("renews with the reveal guard heartbeat and expires after a crash", () => {
    const storage = createMemoryStorage();
    const guard = beginGachaRevealGuard(
      "player-1",
      BASELINE,
      localStorage,
      Date.now(),
      "renewable-token",
    );
    if (!guard) throw new Error("guard was not created");
    const pending = beginGachaPendingReveal(
      "player-1",
      guard,
      { kind: "miss" },
      storage,
    );
    if (!pending) throw new Error("pending reveal was not created");

    vi.advanceTimersByTime(GACHA_REVEAL_GUARD_HEARTBEAT_MS);
    const renewedGuard = renewGachaRevealGuard(
      guard,
      localStorage,
      Date.now(),
    );
    if (!renewedGuard) throw new Error("guard was not renewed");
    const renewedPending = renewGachaPendingReveal(
      pending,
      renewedGuard,
      storage,
    );

    expect(renewedPending?.expiresAt).toBe(renewedGuard.expiresAt);
    vi.setSystemTime(renewedGuard.expiresAt);
    expect(readGachaPendingReveal("player-1", storage)).toBeNull();
    expect(storage.getItem(getGachaPendingRevealKey("player-1"))).toBeNull();
  });

  it("refuses to resurrect a record cleared by reset while commit was late", () => {
    const storage = createMemoryStorage();
    const guard = beginGachaRevealGuard(
      "player-1",
      BASELINE,
      localStorage,
      Date.now(),
      "late-token",
    );
    if (!guard) throw new Error("guard was not created");
    const pending = beginGachaPendingReveal(
      "player-1",
      guard,
      { kind: "miss" },
      storage,
    );
    if (!pending) throw new Error("pending reveal was not created");
    clearGachaPendingReveal("player-1", "late-token", storage);

    expect(
      commitGachaPendingReveal(
        pending,
        {
          coinsAfter: 100,
          save: { ...BASELINE, totalDraws: 5 },
          result: { kind: "miss", totalDraws: 5 },
        },
        storage,
      ),
    ).toBeNull();
    expect(readGachaPendingReveal("player-1", storage)).toBeNull();
  });
});
