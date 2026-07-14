import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../../../utils/firebaseUtil", () => ({ db: mockDb }));

import { createEmptyGachaSave } from "./gachaLogic";
import {
  GACHA_CACHE_PREFIX,
  GACHA_CLOUD_DOC,
  getGachaCacheKey,
  loadGachaCloud,
  readGachaCache,
  recordGachaDraw,
  writeGachaCache,
  type GachaCacheLockManager,
} from "./gachaStorage";

const documentRef = { kind: "gacha-document" };

function snapshot(data: unknown | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  firestoreMocks.doc.mockReturnValue(documentRef);
  firestoreMocks.serverTimestamp.mockReturnValue({ kind: "server-timestamp" });
});

describe("gacha cache", () => {
  it("isolates cached progress by uid", async () => {
    await writeGachaCache("player-a", {
      schemaVersion: 1,
      totalDraws: 1,
      ownedCounts: { kuromi: 1 },
    });
    await writeGachaCache("player-b", {
      schemaVersion: 1,
      totalDraws: 2,
      ownedCounts: { keroppi: 2 },
    });

    expect(getGachaCacheKey("player-a")).toBe(
      `${GACHA_CACHE_PREFIX}player-a`,
    );
    expect(readGachaCache("player-a")?.ownedCounts).toEqual({ kuromi: 1 });
    expect(readGachaCache("player-b")?.ownedCounts).toEqual({ keroppi: 2 });
  });

  it("rejects broken or incompatible cache payloads", () => {
    localStorage.setItem(getGachaCacheKey("broken"), "not-json");
    localStorage.setItem(
      getGachaCacheKey("future"),
      JSON.stringify({ schemaVersion: 2, totalDraws: 9, ownedCounts: {} }),
    );

    expect(readGachaCache("broken")).toBeNull();
    expect(readGachaCache("future")).toBeNull();
  });

  it("normalizes invalid values before returning cached progress", () => {
    localStorage.setItem(
      getGachaCacheKey("player"),
      JSON.stringify({
        schemaVersion: 1,
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
      totalDraws: 3,
      ownedCounts: { "hello-kitty": 3 },
    });
  });

  it("serializes monotonic writes across tabs when Web Locks is available", async () => {
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
          totalDraws: 2,
          ownedCounts: { kuromi: 2 },
        },
        localStorage,
        lockManager,
      ),
    ]);

    expect(readGachaCache("locked-player")).toEqual({
      schemaVersion: 1,
      totalDraws: 3,
      ownedCounts: { kuromi: 2, keroppi: 1 },
    });
  });
});

describe("loadGachaCloud", () => {
  it("loads the Firestore document and refreshes the cache", async () => {
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

  it("does not replace the last successful cache when cloud loading fails", async () => {
    const cached = {
      schemaVersion: 1 as const,
      totalDraws: 1,
      ownedCounts: { "hello-kitty": 1 },
    };
    await writeGachaCache("offline-player", cached);
    firestoreMocks.getDocFromServer.mockRejectedValue(new Error("offline"));

    await expect(loadGachaCloud("offline-player")).rejects.toThrow("offline");
    expect(readGachaCache("offline-player")).toEqual(cached);
  });

  it("returns the newest cache when an older server read finishes late", async () => {
    const newest = {
      schemaVersion: 1 as const,
      totalDraws: 3,
      ownedCounts: { kuromi: 2, keroppi: 1 },
    };
    await writeGachaCache("racing-player", newest);
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        schemaVersion: 1,
        totalDraws: 2,
        ownedCounts: { kuromi: 2 },
      }),
    );

    await expect(loadGachaCloud("racing-player")).resolves.toEqual(newest);
    expect(readGachaCache("racing-player")).toEqual(newest);
  });
});

describe("recordGachaDraw", () => {
  it("creates progress in a transaction and caches only after it commits", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot(null)),
      set: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const result = await recordGachaDraw("new-player", "cinnamoroll");

    expect(result).toEqual({
      characterId: "cinnamoroll",
      isNew: true,
      ownedCount: 1,
      totalDraws: 1,
    });
    expect(transaction.set).toHaveBeenCalledWith(
      documentRef,
      expect.objectContaining({
        schemaVersion: 1,
        totalDraws: 1,
        ownedCounts: { cinnamoroll: 1 },
        createdAt: { kind: "server-timestamp" },
        updatedAt: { kind: "server-timestamp" },
      }),
    );
    expect(readGachaCache("new-player")).toEqual({
      schemaVersion: 1,
      totalDraws: 1,
      ownedCounts: { cinnamoroll: 1 },
    });
  });

  it("keeps the selected character fixed if Firestore retries the transaction", async () => {
    const set = vi.fn();
    const transactionAttempts = [
      {
        get: vi.fn().mockResolvedValue(
          snapshot({
            schemaVersion: 1,
            totalDraws: 1,
            ownedCounts: { kuromi: 1 },
            createdAt: "original-created-at",
          }),
        ),
        set,
      },
      {
        get: vi.fn().mockResolvedValue(
          snapshot({
            schemaVersion: 1,
            totalDraws: 2,
            ownedCounts: { kuromi: 2 },
            createdAt: "original-created-at",
          }),
        ),
        set,
      },
    ];
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => {
        await update(transactionAttempts[0]);
        return update(transactionAttempts[1]);
      },
    );

    const result = await recordGachaDraw("retry-player", "kuromi");

    expect(result).toEqual({
      characterId: "kuromi",
      isNew: false,
      ownedCount: 3,
      totalDraws: 3,
    });
    expect(set).toHaveBeenCalledTimes(2);
    for (const [, writtenData] of set.mock.calls) {
      expect(writtenData.ownedCounts).toEqual(
        expect.objectContaining({ kuromi: expect.any(Number) }),
      );
      expect(writtenData.createdAt).toBe("original-created-at");
    }
    expect(readGachaCache("retry-player")?.ownedCounts).toEqual({ kuromi: 3 });
  });

  it("does not update the cache when the transaction fails", async () => {
    const cached = {
      schemaVersion: 1 as const,
      totalDraws: 1,
      ownedCounts: { keroppi: 1 },
    };
    await writeGachaCache("offline-player", cached);
    firestoreMocks.runTransaction.mockRejectedValue(new Error("unavailable"));

    await expect(
      recordGachaDraw("offline-player", "gudetama"),
    ).rejects.toThrow("unavailable");
    expect(readGachaCache("offline-player")).toEqual(cached);
  });

  it("does not let a late transaction response roll the cache backward", async () => {
    await writeGachaCache("multi-tab-player", {
      schemaVersion: 1,
      totalDraws: 3,
      ownedCounts: { kuromi: 2, keroppi: 1 },
    });
    const transaction = {
      get: vi.fn().mockResolvedValue(
        snapshot({
          schemaVersion: 1,
          totalDraws: 1,
          ownedCounts: { kuromi: 1 },
        }),
      ),
      set: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      recordGachaDraw("multi-tab-player", "kuromi"),
    ).resolves.toMatchObject({ totalDraws: 2 });
    expect(readGachaCache("multi-tab-player")).toEqual({
      schemaVersion: 1,
      totalDraws: 3,
      ownedCounts: { kuromi: 2, keroppi: 1 },
    });
  });
});
