import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  deleteField: vi.fn(),
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../../../utils/firebaseUtil", () => ({ db: mockDb }));

import { GACHA_DRAW_COST, createEmptyGachaSave } from "./gachaLogic";
import {
  acknowledgeGachaPendingReveal,
  compareGachaSaveVersions,
  GACHA_CACHE_PREFIX,
  GACHA_CLOUD_DOC,
  GachaInsufficientCoinsError,
  GachaPendingRevealConflictError,
  GachaResetConflictError,
  getGachaCacheKey,
  isGachaInsufficientCoinsError,
  isGachaPendingRevealConflictError,
  isGachaResetConflictError,
  loadGachaCloud,
  loadGachaMachineState,
  loadPlayerCoins,
  parseGachaCacheValue,
  readGachaCache,
  readGachaMachineCacheState,
  recordGachaAttempt,
  resetGachaCollection,
  writeGachaCache,
  writeGachaMachineCacheState,
  type GachaCacheLockManager,
} from "./gachaStorage";

const documentRef = { kind: "gacha-document" };
const progressRef = { kind: "progress-document" };
const serverTimestamp = { kind: "server-timestamp" };
const deletedField = { kind: "deleted-field" };

function snapshot(data: unknown | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

// 抽獎交易會讀兩個文件：扭蛋子文件 + 玩家進度（代幣）文件
function transactionFor(
  data: unknown | null,
  progressData: unknown | null = { coins: 500 },
) {
  return {
    get: vi.fn().mockImplementation((ref: unknown) =>
      Promise.resolve(
        ref === progressRef ? snapshot(progressData) : snapshot(data),
      ),
    ),
    set: vi.fn(),
    update: vi.fn(),
  };
}

function pendingMissData(
  attemptId: string,
  baselineTotalDraws = 0,
  coinsAfter = 450,
) {
  return {
    schemaVersion: 1,
    attemptId,
    resetVersion: 0,
    baselineSave: {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: baselineTotalDraws,
      ownedCounts: {},
    },
    result: { kind: "miss", totalDraws: baselineTotalDraws + 1 },
    coinsAfter,
    createdAt: 1_723_456_789_000,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // doc(db, "gameProgress", uid) → 進度文件；再深的路徑 → 扭蛋子文件
  firestoreMocks.doc.mockImplementation(
    (_db: unknown, ...segments: string[]) =>
      segments.length > 2 ? documentRef : progressRef,
  );
  firestoreMocks.serverTimestamp.mockReturnValue(serverTimestamp);
  firestoreMocks.deleteField.mockReturnValue(deletedField);
});

describe("gacha cache", () => {
  it("isolates cached progress by uid", async () => {
    await writeGachaCache("player-a", {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    });
    await writeGachaCache("player-b", {
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 2,
      ownedCounts: { keroppi: 2 },
    });

    expect(getGachaCacheKey("player-a")).toBe(
      `${GACHA_CACHE_PREFIX}player-a`,
    );
    expect(readGachaCache("player-a")?.ownedCounts).toEqual({ kuromi: 1 });
    expect(readGachaCache("player-b")?.ownedCounts).toEqual({ keroppi: 2 });
  });

  it("parses storage events and migrates old V1 payloads", () => {
    expect(
      parseGachaCacheValue(JSON.stringify({
        schemaVersion: 1,
        totalDraws: 1,
        ownedCounts: { kuromi: 1 },
      })),
    ).toEqual({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    });
    expect(parseGachaCacheValue(null)).toBeNull();
    expect(parseGachaCacheValue("not-json")).toBeNull();
    expect(
      parseGachaCacheValue(JSON.stringify({
        schemaVersion: 2,
        totalDraws: 9,
        ownedCounts: {},
      })),
    ).toBeNull();
  });

  it("normalizes a bounded pending reveal alongside the cached save", () => {
    localStorage.setItem(
      getGachaCacheKey("pending-player"),
      JSON.stringify({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
        pendingReveal: pendingMissData("cached-attempt"),
      }),
    );

    expect(readGachaMachineCacheState("pending-player")).toEqual({
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      pendingReveal: {
        schemaVersion: 1,
        attemptId: "cached-attempt",
        resetVersion: 0,
        baselineSave: {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 0,
          ownedCounts: {},
        },
        committedAttempt: {
          save: {
            schemaVersion: 1,
            resetVersion: 0,
            totalDraws: 1,
            ownedCounts: {},
          },
          result: { kind: "miss", totalDraws: 1 },
          coinsAfter: 450,
        },
        createdAt: 1_723_456_789_000,
      },
    });
    expect(readGachaCache("pending-player")).toEqual(createEmptyGachaSave());
  });

  it("keeps legacy readers on the exact pre-reveal character baseline", () => {
    const baselineSave = {
      schemaVersion: 1,
      resetVersion: 7,
      totalDraws: 3,
      ownedCounts: { kuromi: 1 },
      unknownOwnedCounts: { "future-character": 2 },
    };
    localStorage.setItem(
      getGachaCacheKey("character-pending-player"),
      JSON.stringify({
        schemaVersion: 1,
        resetVersion: 7,
        totalDraws: 4,
        ownedCounts: { kuromi: 1, "hello-kitty": 1 },
        unknownOwnedCounts: { "future-character": 2 },
        pendingReveal: {
          schemaVersion: 1,
          attemptId: "character-attempt",
          resetVersion: 7,
          baselineSave,
          result: {
            kind: "character",
            characterId: "hello-kitty",
            isNew: true,
            ownedCount: 1,
            totalDraws: 4,
          },
          coinsAfter: 450,
          createdAt: 1_723_456_789_000,
        },
      }),
    );

    expect(
      readGachaMachineCacheState("character-pending-player")?.save,
    ).toEqual({
      schemaVersion: 1,
      resetVersion: 7,
      totalDraws: 4,
      ownedCounts: { "hello-kitty": 1, kuromi: 1 },
      unknownOwnedCounts: { "future-character": 2 },
    });
    expect(readGachaCache("character-pending-player")).toEqual(baselineSave);
  });

  it("keeps the previous 39-item roster in cached progress", async () => {
    await writeGachaCache("previous-roster-player", {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 2,
      ownedCounts: {
        "crayon-shinchan": 1,
        doraemon: 1,
      },
    });

    expect(readGachaCache("previous-roster-player")).toEqual({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 2,
      ownedCounts: {
        "crayon-shinchan": 1,
        doraemon: 1,
      },
    });
  });

  it("keeps newly appended individual characters in cached progress", async () => {
    await writeGachaCache("expanded-roster-player", {
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 4,
      ownedCounts: {
        "crayon-shinchan": 1,
        "waniyama-san": 1,
        buriburizaemon: 1,
        dorami: 1,
      },
    });

    expect(readGachaCache("expanded-roster-player")).toEqual({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 4,
      ownedCounts: {
        "crayon-shinchan": 1,
        "waniyama-san": 1,
        buriburizaemon: 1,
        dorami: 1,
      },
    });
  });

  it("normalizes invalid values before returning cached progress", () => {
    localStorage.setItem(
      getGachaCacheKey("player"),
      JSON.stringify({
        schemaVersion: 1,
        resetVersion: 3.9,
        totalDraws: -3,
        ownedCounts: {
          "hello-kitty": 3.8,
          kuromi: -2,
          unknown: 100,
        },
      }),
    );

    expect(readGachaCache("player")).toEqual({
      schemaVersion: 1,
      resetVersion: 3,
      totalDraws: 103,
      ownedCounts: { "hello-kitty": 3 },
      unknownOwnedCounts: { unknown: 100 },
    });
  });

  it("compares resetVersion before totalDraws", () => {
    const oldCollection = {
      schemaVersion: 1 as const,
      resetVersion: 1,
      totalDraws: 50,
      ownedCounts: { kuromi: 50 },
    };
    const resetCollection = {
      schemaVersion: 1 as const,
      resetVersion: 2,
      totalDraws: 0,
      ownedCounts: {},
    };
    const newerDraw = {
      ...resetCollection,
      totalDraws: 1,
      ownedCounts: { keroppi: 1 },
    };

    expect(compareGachaSaveVersions(resetCollection, oldCollection)).toBe(1);
    expect(compareGachaSaveVersions(oldCollection, resetCollection)).toBe(-1);
    expect(compareGachaSaveVersions(newerDraw, resetCollection)).toBe(1);
    expect(compareGachaSaveVersions(resetCollection, resetCollection)).toBe(0);
  });

  it("lets a newer reset replace an older high-draw cache", async () => {
    await writeGachaCache("reset-player", {
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 50,
      ownedCounts: { kuromi: 50 },
    });
    await writeGachaCache("reset-player", {
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 0,
      ownedCounts: {},
    });
    await writeGachaCache("reset-player", {
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 99,
      ownedCounts: { kuromi: 99 },
    });

    expect(readGachaCache("reset-player")).toEqual({
      schemaVersion: 1,
      resetVersion: 2,
      totalDraws: 0,
      ownedCounts: {},
    });
  });

  it("serializes freshness-checked writes with Web Locks", async () => {
    let queue = Promise.resolve();
    const lockManager: GachaCacheLockManager = {
      request<T>(_name: string, callback: () => T | PromiseLike<T>) {
        const next = queue.then(callback);
        queue = next.then(
          () => undefined,
          () => undefined,
        );
        return next;
      },
    };

    await Promise.all([
      writeGachaCache(
        "locked-player",
        {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 3,
          ownedCounts: { kuromi: 2, keroppi: 1 },
        },
        localStorage,
        lockManager,
      ),
      writeGachaCache(
        "locked-player",
        {
          schemaVersion: 1,
          resetVersion: 0,
          totalDraws: 2,
          ownedCounts: { kuromi: 2 },
        },
        localStorage,
        lockManager,
      ),
    ]);

    expect(readGachaCache("locked-player")?.totalDraws).toBe(3);
  });
});

describe("loadGachaCloud", () => {
  it("returns the exact server pending receipt for crash recovery", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
        pendingReveal: pendingMissData("server-attempt"),
      }),
    );

    const state = await loadGachaMachineState("crashed-player");

    expect(state.pendingReveal?.attemptId).toBe("server-attempt");
    expect(state.pendingReveal?.committedAttempt.result).toEqual({
      kind: "miss",
      totalDraws: 1,
    });
    expect(
      readGachaMachineCacheState("crashed-player")?.pendingReveal?.attemptId,
    ).toBe("server-attempt");
    await expect(loadGachaCloud("crashed-player")).resolves.toEqual(
      createEmptyGachaSave(),
    );
  });

  it("loads the Firestore document, migrates it, and refreshes the cache", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        schemaVersion: 1,
        totalDraws: 5,
        ownedCounts: { pochacco: 2, gudetama: 3 },
      }),
    );

    const save = await loadGachaCloud("player-1");

    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      mockDb,
      "gameProgress",
      "player-1",
      "littleGames",
      GACHA_CLOUD_DOC,
    );
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledWith(documentRef);
    expect(save).toEqual({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 5,
      ownedCounts: { pochacco: 2, gudetama: 3 },
    });
    expect(readGachaCache("player-1")).toEqual(save);
  });

  it("returns and caches an empty save when the cloud document is missing", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(snapshot(null));

    await expect(loadGachaCloud("new-player")).resolves.toEqual(
      createEmptyGachaSave(),
    );
    expect(readGachaCache("new-player")).toEqual(createEmptyGachaSave());
  });

  it("does not replace the last successful cache when loading fails", async () => {
    const cached = {
      schemaVersion: 1 as const,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { "hello-kitty": 1 },
    };
    await writeGachaCache("offline-player", cached);
    firestoreMocks.getDocFromServer.mockRejectedValue(new Error("offline"));

    await expect(loadGachaCloud("offline-player")).rejects.toThrow("offline");
    expect(readGachaCache("offline-player")).toEqual(cached);
  });

  it("returns the newer cache when an older server read finishes late", async () => {
    const newest = {
      schemaVersion: 1 as const,
      resetVersion: 2,
      totalDraws: 0,
      ownedCounts: {},
    };
    await writeGachaCache("racing-player", newest);
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        schemaVersion: 1,
        resetVersion: 1,
        totalDraws: 20,
        ownedCounts: { kuromi: 20 },
      }),
    );

    await expect(loadGachaCloud("racing-player")).resolves.toEqual(newest);
    expect(readGachaCache("racing-player")).toEqual(newest);
  });
});

describe("loadPlayerCoins", () => {
  it("reads the coin balance from the player's progress document", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({ coins: 123, level: 5 }),
    );

    await expect(loadPlayerCoins("player-1")).resolves.toBe(123);
    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      mockDb,
      "gameProgress",
      "player-1",
    );
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledWith(progressRef);
  });

  it("returns 0 when the progress document is missing or malformed", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValueOnce(snapshot(null));
    await expect(loadPlayerCoins("new-player")).resolves.toBe(0);

    firestoreMocks.getDocFromServer.mockResolvedValueOnce(
      snapshot({ coins: "many" }),
    );
    await expect(loadPlayerCoins("weird-player")).resolves.toBe(0);

    firestoreMocks.getDocFromServer.mockResolvedValueOnce(
      snapshot({ coins: -12 }),
    );
    await expect(loadPlayerCoins("negative-player")).resolves.toBe(0);
  });
});

describe("recordGachaAttempt", () => {
  it("creates character progress and caches only after the transaction commits", async () => {
    const transaction = transactionFor(null);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const applied = await recordGachaAttempt(
      "new-player",
      { kind: "character", characterId: "cinnamoroll" },
      0,
      "atomic-attempt",
    );

    expect(applied).toEqual({
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { cinnamoroll: 1 },
      },
      result: {
        kind: "character",
        characterId: "cinnamoroll",
        isNew: true,
        ownedCount: 1,
        totalDraws: 1,
      },
      coinsAfter: 500 - GACHA_DRAW_COST,
    });
    expect(transaction.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { cinnamoroll: 1 },
        pendingReveal: expect.objectContaining({
          attemptId: "atomic-attempt",
          baselineSave: createEmptyGachaSave(),
          result: expect.objectContaining({
            kind: "character",
            characterId: "cinnamoroll",
          }),
          coinsAfter: 500 - GACHA_DRAW_COST,
          createdAt: serverTimestamp,
        }),
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(progressRef, {
      coins: 500 - GACHA_DRAW_COST,
      updatedAt: serverTimestamp,
    });
    expect(readGachaCache("new-player")).toEqual(createEmptyGachaSave());
    expect(readGachaMachineCacheState("new-player")?.save).toEqual(
      applied.save,
    );
    expect(
      readGachaMachineCacheState("new-player")?.pendingReveal?.attemptId,
    ).toBe("atomic-attempt");
  });

  it("debits exactly one draw cost from the player's coins", async () => {
    const transaction = transactionFor(
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 3,
        ownedCounts: { kuromi: 1 },
        createdAt: "original-created-at",
      },
      { coins: GACHA_DRAW_COST },
    );
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const applied = await recordGachaAttempt(
      "exact-coins-player",
      { kind: "miss" },
      0,
    );

    expect(applied.coinsAfter).toBe(0);
    expect(transaction.update).toHaveBeenCalledWith(progressRef, {
      coins: 0,
      updatedAt: serverTimestamp,
    });
  });

  it("throws a typed error and writes nothing when coins are insufficient", async () => {
    const transaction = transactionFor(
      {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 3,
        ownedCounts: { kuromi: 1 },
      },
      { coins: GACHA_DRAW_COST - 1 },
    );
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const promise = recordGachaAttempt(
      "poor-player",
      { kind: "character", characterId: "kuromi" },
      0,
    );

    await expect(promise).rejects.toBeInstanceOf(GachaInsufficientCoinsError);
    await promise.catch((error: unknown) => {
      expect(isGachaInsufficientCoinsError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "GACHA_INSUFFICIENT_COINS",
        requiredCoins: GACHA_DRAW_COST,
        availableCoins: GACHA_DRAW_COST - 1,
      });
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
    expect(readGachaCache("poor-player")).toBeNull();
  });

  it("rejects a second tab or device while a paid reveal is pending", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: {},
      pendingReveal: pendingMissData("first-device-attempt"),
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const promise = recordGachaAttempt(
      "shared-player",
      { kind: "character", characterId: "kuromi" },
      0,
      "second-device-attempt",
    );

    await expect(promise).rejects.toBeInstanceOf(
      GachaPendingRevealConflictError,
    );
    await promise.catch((error: unknown) => {
      expect(isGachaPendingRevealConflictError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "GACHA_PENDING_REVEAL_CONFLICT",
        attemptId: "first-device-attempt",
      });
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("replays the same attempt id without charging twice", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: {},
      pendingReveal: pendingMissData("retry-attempt"),
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const replay = await recordGachaAttempt(
      "retry-player",
      { kind: "miss" },
      0,
      "retry-attempt",
    );

    expect(replay).toEqual({
      save: {
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: {},
      },
      result: { kind: "miss", totalDraws: 1 },
      coinsAfter: 450,
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("treats a missing progress document as zero coins", async () => {
    const transaction = transactionFor(null, null);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      recordGachaAttempt("no-progress-player", { kind: "miss" }, 0),
    ).rejects.toMatchObject({ availableCoins: 0 });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("merges only the selected count while retaining raw unknown leaves", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 4,
      totalDraws: 5,
      ownedCounts: { kuromi: 2, futureCharacter: 3 },
      createdAt: "original-created-at",
      futureTopLevelField: true,
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const applied = await recordGachaAttempt(
      "existing-player",
      { kind: "character", characterId: "kuromi" },
      4,
    );

    expect(applied.save).toEqual({
      schemaVersion: 1,
      resetVersion: 4,
      totalDraws: 6,
      ownedCounts: { kuromi: 3 },
      unknownOwnedCounts: { futureCharacter: 3 },
    });
    expect(readGachaCache("existing-player")).toEqual({
      schemaVersion: 1,
      resetVersion: 4,
      totalDraws: 5,
      ownedCounts: { kuromi: 2 },
      unknownOwnedCounts: { futureCharacter: 3 },
    });
    expect(readGachaMachineCacheState("existing-player")?.save).toEqual(
      applied.save,
    );

    expect(transaction.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        schemaVersion: 1,
        resetVersion: 4,
        totalDraws: 6,
        ownedCounts: { kuromi: 3 },
        updatedAt: serverTimestamp,
        pendingReveal: expect.objectContaining({
          result: expect.objectContaining({
            kind: "character",
            characterId: "kuromi",
          }),
        }),
      }),
      { merge: true },
    );
  });

  it("records a miss without writing ownedCounts", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 2,
      ownedCounts: { kuromi: 1 },
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const applied = await recordGachaAttempt(
      "miss-player",
      { kind: "miss" },
      1,
    );

    expect(applied.result).toEqual({ kind: "miss", totalDraws: 3 });
    expect(transaction.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        schemaVersion: 1,
        resetVersion: 1,
        totalDraws: 3,
        updatedAt: serverTimestamp,
        pendingReveal: expect.objectContaining({
          result: { kind: "miss", totalDraws: 3 },
        }),
      }),
      { merge: true },
    );
    const written = transaction.set.mock.calls[0]?.[1];
    expect(written).not.toHaveProperty("ownedCounts");
  });

  it("keeps the supplied outcome fixed if Firestore retries", async () => {
    const transactions = [
      transactionFor({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { kuromi: 1 },
        createdAt: "original-created-at",
      }),
      transactionFor({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 2,
        ownedCounts: { kuromi: 2 },
        createdAt: "original-created-at",
      }),
    ];
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => {
        await update(transactions[0]);
        return update(transactions[1]);
      },
    );

    const applied = await recordGachaAttempt(
      "retry-player",
      { kind: "character", characterId: "kuromi" },
      0,
    );

    expect(applied.result).toEqual({
      kind: "character",
      characterId: "kuromi",
      isNew: false,
      ownedCount: 3,
      totalDraws: 3,
    });
    for (const transaction of transactions) {
      expect(transaction.set).toHaveBeenCalledWith(
        documentRef,
        expect.objectContaining({ ownedCounts: { kuromi: expect.any(Number) } }),
        { merge: true },
      );
    }
  });

  it("throws a typed conflict when the collection was reset", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 3,
      totalDraws: 0,
      ownedCounts: {},
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const promise = recordGachaAttempt(
      "conflict-player",
      { kind: "miss" },
      2,
    );

    await expect(promise).rejects.toBeInstanceOf(GachaResetConflictError);
    await promise.catch((error: unknown) => {
      expect(isGachaResetConflictError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "GACHA_RESET_CONFLICT",
        expectedResetVersion: 2,
        actualResetVersion: 3,
      });
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(readGachaCache("conflict-player")).toBeNull();
  });

  it("does not update the cache when the transaction fails", async () => {
    const cached = {
      schemaVersion: 1 as const,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: { keroppi: 1 },
    };
    await writeGachaCache("offline-player", cached);
    firestoreMocks.runTransaction.mockRejectedValue(new Error("unavailable"));

    await expect(
      recordGachaAttempt("offline-player", { kind: "miss" }, 0),
    ).rejects.toThrow("unavailable");
    expect(readGachaCache("offline-player")).toEqual(cached);
  });
});

describe("acknowledgeGachaPendingReveal", () => {
  it("clears only the matching server receipt and cache slot", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: {},
      pendingReveal: pendingMissData("ack-attempt"),
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      acknowledgeGachaPendingReveal("ack-player", "ack-attempt"),
    ).resolves.toBe(true);

    expect(transaction.update).toHaveBeenCalledWith(documentRef, {
      pendingReveal: deletedField,
      updatedAt: serverTimestamp,
    });
    expect(
      readGachaMachineCacheState("ack-player")?.pendingReveal,
    ).toBeNull();
  });

  it("cannot clear a newer receipt with a stale attempt id", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: {},
      pendingReveal: pendingMissData("newer-attempt"),
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      acknowledgeGachaPendingReveal("ack-player", "stale-attempt"),
    ).resolves.toBe(false);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(
      readGachaMachineCacheState("ack-player")?.pendingReveal?.attemptId,
    ).toBe("newer-attempt");
  });

  it("does not let a stale load resurrect an acknowledged receipt", async () => {
    const save = {
      schemaVersion: 1 as const,
      resetVersion: 0,
      totalDraws: 1,
      ownedCounts: {},
    };
    const pendingReveal = {
      schemaVersion: 1 as const,
      attemptId: "ack-race-attempt",
      resetVersion: 0,
      baselineSave: createEmptyGachaSave(),
      committedAttempt: {
        save,
        result: { kind: "miss" as const, totalDraws: 1 },
        coinsAfter: 450,
      },
      createdAt: 1_723_456_789_000,
    };
    const transaction = transactionFor({
      ...save,
      pendingReveal: pendingMissData("ack-race-attempt"),
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );
    await writeGachaMachineCacheState("ack-race-player", {
      save,
      pendingReveal,
    });
    await acknowledgeGachaPendingReveal(
      "ack-race-player",
      "ack-race-attempt",
    );

    await writeGachaMachineCacheState("ack-race-player", {
      save,
      pendingReveal,
    });

    expect(
      readGachaMachineCacheState("ack-race-player")?.pendingReveal,
    ).toBeNull();
  });

  it("tombstones an attempt already acknowledged on another device", async () => {
    const save = {
      schemaVersion: 1 as const,
      resetVersion: 0,
      totalDraws: 2,
      ownedCounts: {},
    };
    const transaction = transactionFor(save);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      acknowledgeGachaPendingReveal("remote-ack-player", "remote-ack-attempt"),
    ).resolves.toBe(false);
    await writeGachaMachineCacheState("remote-ack-player", {
      save,
      pendingReveal: {
        schemaVersion: 1,
        attemptId: "remote-ack-attempt",
        resetVersion: 0,
        baselineSave: {
          ...createEmptyGachaSave(),
          totalDraws: 1,
        },
        committedAttempt: {
          save,
          result: { kind: "miss", totalDraws: 2 },
          coinsAfter: 400,
        },
        createdAt: 1_723_456_789_000,
      },
    });

    expect(
      readGachaMachineCacheState("remote-ack-player")?.pendingReveal,
    ).toBeNull();
    expect(readGachaCache("remote-ack-player")).toEqual(save);
  });
});

describe("resetGachaCollection", () => {
  it("clears an existing collection while preserving unrelated top-level fields", async () => {
    const transaction = transactionFor({
      schemaVersion: 1,
      resetVersion: 4,
      totalDraws: 12,
      ownedCounts: { kuromi: 10, futureCharacter: 2 },
      unknownOwnedCounts: { futureCharacter: 2 },
      createdAt: "original-created-at",
      futureTopLevelField: true,
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const save = await resetGachaCollection("reset-player");

    expect(save).toEqual({
      schemaVersion: 1,
      resetVersion: 5,
      totalDraws: 0,
      ownedCounts: {},
    });
    expect(transaction.update).toHaveBeenCalledWith(documentRef, {
      schemaVersion: 1,
      resetVersion: 5,
      totalDraws: 0,
      ownedCounts: {},
      unknownOwnedCounts: {},
      pendingReveal: deletedField,
      resetAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
    expect(readGachaCache("reset-player")).toEqual(save);
  });

  it("creates a reset document with timestamps when progress is missing", async () => {
    const transaction = transactionFor(null);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const save = await resetGachaCollection("new-reset-player");

    expect(save.resetVersion).toBe(1);
    expect(transaction.set).toHaveBeenCalledWith(documentRef, {
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 0,
      ownedCounts: {},
      unknownOwnedCounts: {},
      createdAt: serverTimestamp,
      resetAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });
  });

  it("does not clear the cache when reset fails", async () => {
    const cached = {
      schemaVersion: 1 as const,
      resetVersion: 1,
      totalDraws: 2,
      ownedCounts: { kuromi: 2 },
    };
    await writeGachaCache("failed-reset", cached);
    firestoreMocks.runTransaction.mockRejectedValue(new Error("offline"));

    await expect(resetGachaCollection("failed-reset")).rejects.toThrow(
      "offline",
    );
    expect(readGachaCache("failed-reset")).toEqual(cached);
  });
});
