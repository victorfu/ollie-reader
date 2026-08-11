import { beforeEach, describe, expect, it } from "vitest";
import {
  GACHA_REVEAL_GUARD_HEARTBEAT_MS,
  GACHA_REVEAL_GUARD_TTL_MS,
  beginGachaRevealGuard,
  clearGachaRevealGuards,
  endGachaRevealGuard,
  getGachaRevealGuardKey,
  getGachaSaveBeforeGuards,
  isGachaSaveGuarded,
  listActiveGachaRevealGuards,
  parseGachaRevealGuard,
  renewGachaRevealGuard,
} from "./gachaRevealGuard";

beforeEach(() => {
  localStorage.clear();
});

describe("gacha cross-tab reveal guards", () => {
  it("rejects a guard that cannot be read back durably", () => {
    const noOpStorage = {
      length: 0,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    expect(beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 0,
        ownedCounts: {},
      },
      noOpStorage,
      100,
      "not-durable",
    )).toBeNull();
  });

  it("guards only post-baseline saves in the matching reset generation", () => {
    const guard = beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 2,
        totalDraws: 4,
        ownedCounts: { kuromi: 1 },
      },
      localStorage,
      1_000,
      "draw-a",
    );
    expect(guard).not.toBeNull();

    const guards = listActiveGachaRevealGuards("player-1", localStorage, 1_001);
    expect(guards).toEqual([guard]);
    expect(isGachaSaveGuarded({
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 5,
      ownedCounts: { kuromi: 1 },
    }, guards, 1_001)).toBe(true);
    expect(getGachaSaveBeforeGuards({
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 5,
      ownedCounts: { kuromi: 2 },
    }, guards, 1_001)).toEqual(guard?.baselineSave);
    expect(isGachaSaveGuarded({
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 4,
      ownedCounts: {},
    }, guards, 1_001)).toBe(false);
    expect(isGachaSaveGuarded({
      schemaVersion: 1,
      resetVersion: 3,
      totalDraws: 0,
      ownedCounts: {},
    }, guards, 1_001)).toBe(false);
  });

  it("keeps concurrent guards independent and clears them on reveal/reset", () => {
    const first = beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 0,
        ownedCounts: {},
      },
      localStorage,
      10,
      "draw-a",
    );
    const second = beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 0,
        ownedCounts: {},
      },
      localStorage,
      10,
      "draw-b",
    );
    expect(listActiveGachaRevealGuards("player-1", localStorage, 11)).toHaveLength(2);

    endGachaRevealGuard(first, localStorage);
    expect(listActiveGachaRevealGuards("player-1", localStorage, 11)).toEqual([
      second,
    ]);

    clearGachaRevealGuards("player-1", localStorage);
    expect(listActiveGachaRevealGuards("player-1", localStorage, 11)).toEqual([]);
  });

  it("renews a live lease and eventually expires without another heartbeat", () => {
    const startedAt = 2_000;
    const guard = beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 0,
        ownedCounts: {},
      },
      localStorage,
      startedAt,
      "renewed-draw",
    );
    if (!guard) throw new Error("guard was not created");

    const heartbeatAt = startedAt + GACHA_REVEAL_GUARD_HEARTBEAT_MS;
    const renewed = renewGachaRevealGuard(guard, localStorage, heartbeatAt);
    expect(renewed?.expiresAt).toBe(
      heartbeatAt + GACHA_REVEAL_GUARD_TTL_MS,
    );
    expect(
      listActiveGachaRevealGuards(
        "player-1",
        localStorage,
        guard.expiresAt + 1,
      ),
    ).toEqual([renewed]);
    expect(
      listActiveGachaRevealGuards(
        "player-1",
        localStorage,
        heartbeatAt + GACHA_REVEAL_GUARD_TTL_MS,
      ),
    ).toEqual([]);
  });

  it("expires crash-left markers and removes malformed entries", () => {
    const guard = beginGachaRevealGuard(
      "player-1",
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 0,
        ownedCounts: {},
      },
      localStorage,
      500,
      "stale-draw",
    );
    if (!guard) throw new Error("guard was not created");
    const key = getGachaRevealGuardKey(guard);
    expect(
      listActiveGachaRevealGuards(
        "player-1",
        localStorage,
        500 + GACHA_REVEAL_GUARD_TTL_MS,
      ),
    ).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();

    localStorage.setItem(key, "not-json");
    expect(parseGachaRevealGuard(localStorage.getItem(key), "player-1")).toBeNull();
    expect(listActiveGachaRevealGuards("player-1", localStorage, 501)).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
