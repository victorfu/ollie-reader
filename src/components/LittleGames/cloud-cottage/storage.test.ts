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

import { createInitialPetSave } from "./logic/petState";
import type { PetSaveV1 } from "./types";
import {
  COTTAGE_ALREADY_OWNED,
  COTTAGE_CACHE_PREFIX,
  COTTAGE_CLOUD_DOC,
  COTTAGE_INSUFFICIENT_COINS,
  CottageAlreadyOwnedError,
  CottageInsufficientCoinsError,
  commitCottageCareAction,
  commitCottagePersonalizationAction,
  commitCottagePersonalizationActions,
  compareCottageSaveVersions,
  getCottageCacheKey,
  isCottageAlreadyOwnedError,
  isCottageInsufficientCoinsError,
  loadCottageCloud,
  loadCottageCoins,
  parseCottageCacheValue,
  purchaseCottageProduct,
  readCottageCache,
  reconcileCottageSaveSnapshots,
  saveCottageCloud,
  writeCottageCache,
  type CottageCacheLockManager,
} from "./storage";

const NOW = new Date(2026, 6, 30, 12, 0, 0, 0).getTime();
const LOCAL_DATE = "2026-07-30";
const cottageRef = { kind: "cottage-document" };
const progressRef = { kind: "progress-document" };
const serverTimestampMarker = { kind: "server-timestamp" };

function snapshot(data: unknown | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

function transactionFor(
  cottageData: unknown | null,
  progressData: unknown | null = { coins: 500 },
) {
  return {
    get: vi.fn().mockImplementation((ref: unknown) =>
      Promise.resolve(
        ref === progressRef
          ? snapshot(progressData)
          : snapshot(cottageData),
      ),
    ),
    set: vi.fn(),
    update: vi.fn(),
  };
}

function makeSave(
  revision: number = 0,
  clientUpdatedAt: number = NOW,
): PetSaveV1 {
  return {
    ...createInitialPetSave(NOW, LOCAL_DATE),
    revision,
    clientUpdatedAt,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  firestoreMocks.doc.mockImplementation(
    (_db: unknown, ...segments: string[]) =>
      segments.length > 2 ? cottageRef : progressRef,
  );
  firestoreMocks.serverTimestamp.mockReturnValue(serverTimestampMarker);
});

describe("Cloud Cottage cache", () => {
  it("isolates JSON cache entries by uid", async () => {
    await writeCottageCache("player-a", makeSave(1, NOW));
    await writeCottageCache("player-b", makeSave(2, NOW + 1));

    expect(getCottageCacheKey("player-a")).toBe(
      `${COTTAGE_CACHE_PREFIX}player-a`,
    );
    expect(readCottageCache("player-a")?.revision).toBe(1);
    expect(readCottageCache("player-b")?.revision).toBe(2);
  });

  it("rejects malformed or foreign schema JSON and normalizes partial V1", () => {
    expect(parseCottageCacheValue(null)).toBeNull();
    expect(parseCottageCacheValue("not-json")).toBeNull();
    expect(
      parseCottageCacheValue(JSON.stringify({ schemaVersion: 2 })),
    ).toBeNull();

    const parsed = parseCottageCacheValue(
      JSON.stringify({
        schemaVersion: 1,
        revision: 3.9,
        clientUpdatedAt: NOW,
        inventory: {
          snacks: { apple: 2.8, unknown: 99 },
          toys: ["ball", "ball", "unknown"],
        },
      }),
    );

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      revision: 3,
      clientUpdatedAt: NOW,
      inventory: {
        snacks: { apple: 2 },
        toys: ["ball"],
      },
    });
    expect(parsed?.inventory.furniture).toContain("cloud-bed");
  });

  it("compares revision first and clientUpdatedAt only as a tie-breaker", () => {
    const revisionWins = makeSave(2, NOW - 10_000);
    const timestampOnly = makeSave(1, NOW + 10_000);
    const laterTie = makeSave(2, NOW + 1);

    expect(compareCottageSaveVersions(revisionWins, timestampOnly)).toBe(1);
    expect(compareCottageSaveVersions(timestampOnly, revisionWins)).toBe(-1);
    expect(compareCottageSaveVersions(laterTie, revisionWins)).toBe(1);
    expect(compareCottageSaveVersions(revisionWins, revisionWins)).toBe(0);
  });

  it("keeps a fresher cache when a stale write arrives", async () => {
    const newest = makeSave(5, NOW + 5);
    await writeCottageCache("player", newest);
    await writeCottageCache("player", makeSave(4, NOW + 100));

    expect(readCottageCache("player")).toEqual(newest);
  });

  it("keeps fresher mutable state while unioning permanent ownership", () => {
    const cloud = makeSave(2, NOW - 20);
    cloud.stats.mood = 88;
    cloud.inventory.toys = ["ball"];
    cloud.inventory.outfits = ["strawberry-clip"];
    cloud.inventory.furniture.push("lamp");
    cloud.inventory.wallpapers.push("starry-night");
    cloud.inventory.floors.push("cloud-carpet");

    const cached = makeSave(5, NOW - 10);
    cached.stats.mood = 71;
    cached.inventory.snacks = { pudding: 2 };
    cached.inventory.toys = ["frisbee"];
    cached.inventory.outfits = ["sailor-hat"];
    cached.inventory.furniture.push("plant");
    cached.inventory.wallpapers.push("candy-stripes");
    cached.inventory.floors.push("frosting-check");
    // These references become valid only after ownership is reconciled.
    cached.equipped = { head: "strawberry-clip" };
    cached.room = {
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [{ id: "lamp", x: 20, y: 70, zone: "floor" }],
    };

    const reconciled = reconcileCottageSaveSnapshots(
      cloud,
      cached,
      NOW,
      LOCAL_DATE,
    );

    expect(reconciled).toMatchObject({
      revision: 5,
      stats: { mood: 71 },
      inventory: { snacks: { pudding: 2 } },
      equipped: { head: "strawberry-clip" },
      room: {
        wallpaperId: "starry-night",
        floorId: "cloud-carpet",
        placed: [{ id: "lamp", x: 20, y: 70, zone: "floor" }],
      },
    });
    expect(reconciled.inventory.toys).toEqual(["frisbee", "ball"]);
    expect(reconciled.inventory.outfits).toEqual([
      "sailor-hat",
      "strawberry-clip",
    ]);
    expect(reconciled.inventory.furniture).toEqual(
      expect.arrayContaining(["cloud-bed", "plant", "lamp"]),
    );
    expect(reconciled.inventory.wallpapers).toEqual(
      expect.arrayContaining(["cloud-blue", "candy-stripes", "starry-night"]),
    );
    expect(reconciled.inventory.floors).toEqual(
      expect.arrayContaining(["cream-wood", "frosting-check", "cloud-carpet"]),
    );
  });

  it("merges permanent ownership even when the incoming cache write is stale", async () => {
    const cached = makeSave(5, NOW - 5);
    cached.stats.mood = 73;
    cached.inventory.furniture.push("lamp");
    await writeCottageCache("ownership-cache", cached);

    const cloud = makeSave(3, NOW - 1);
    cloud.stats.mood = 91;
    cloud.inventory.toys.push("ball");
    await writeCottageCache("ownership-cache", cloud);

    const reconciled = readCottageCache("ownership-cache");
    expect(reconciled?.revision).toBe(5);
    expect(reconciled?.stats.mood).toBe(73);
    expect(reconciled?.inventory.furniture).toContain("lamp");
    expect(reconciled?.inventory.toys).toContain("ball");
  });

  it("serializes freshness checks with Web Locks", async () => {
    let queue = Promise.resolve();
    const lockManager: CottageCacheLockManager = {
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
      writeCottageCache(
        "locked-player",
        makeSave(4, NOW + 4),
        localStorage,
        lockManager,
      ),
      writeCottageCache(
        "locked-player",
        makeSave(3, NOW + 100),
        localStorage,
        lockManager,
      ),
    ]);

    expect(readCottageCache("locked-player")?.revision).toBe(4);
  });
});

describe("Cloud Cottage cloud persistence", () => {
  it("loads, normalizes, and caches the Firestore document", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        ...makeSave(2, NOW - 1),
        createdAt: serverTimestampMarker,
        updatedAt: serverTimestampMarker,
      }),
    );

    const save = await loadCottageCloud("player-1", localStorage, NOW);

    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      mockDb,
      "gameProgress",
      "player-1",
      "littleGames",
      COTTAGE_CLOUD_DOC,
    );
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledWith(cottageRef);
    expect(save.revision).toBe(2);
    expect(save).not.toHaveProperty("createdAt");
    expect(save).not.toHaveProperty("updatedAt");
    expect(readCottageCache("player-1")).toEqual(save);
  });

  it("returns an initial cache-safe save when the cloud document is missing", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue(snapshot(null));

    await expect(
      loadCottageCloud("new-player", localStorage, NOW),
    ).resolves.toEqual(createInitialPetSave(NOW, LOCAL_DATE));
    expect(readCottageCache("new-player")).toEqual(
      createInitialPetSave(NOW, LOCAL_DATE),
    );
  });

  it("does not let a late stale cloud response replace a newer cache", async () => {
    const newest = makeSave(7, NOW + 7);
    await writeCottageCache("racing-player", newest);
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot(makeSave(6, NOW + 100)),
    );

    await expect(
      loadCottageCloud("racing-player", localStorage, NOW),
    ).resolves.toEqual(newest);
    expect(readCottageCache("racing-player")).toEqual(newest);
  });

  it("leaves a successful cache untouched when loading fails", async () => {
    const cached = makeSave(3, NOW);
    await writeCottageCache("offline-player", cached);
    firestoreMocks.getDocFromServer.mockRejectedValue(new Error("offline"));

    await expect(
      loadCottageCloud("offline-player", localStorage, NOW),
    ).rejects.toThrow("offline");
    expect(readCottageCache("offline-player")).toEqual(cached);
  });

  it("writes a newer save with server timestamps only in the envelope", async () => {
    const current = {
      ...makeSave(1, NOW - 1),
      createdAt: "original-created-at",
    };
    const candidate = makeSave(2, NOW);
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      saveCottageCloud("saving-player", candidate, localStorage, NOW),
    ).resolves.toEqual(candidate);

    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      {
        ...candidate,
        createdAt: "original-created-at",
        updatedAt: serverTimestampMarker,
      },
    );
    const cached = readCottageCache("saving-player");
    expect(cached).toEqual(candidate);
    expect(cached).not.toHaveProperty("createdAt");
    expect(cached).not.toHaveProperty("updatedAt");
  });

  it("refuses to overwrite a fresher Firestore save", async () => {
    const cloud = makeSave(5, NOW + 5);
    const transaction = transactionFor(cloud);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      saveCottageCloud("stale-player", makeSave(4, NOW + 100), localStorage, NOW),
    ).resolves.toEqual(cloud);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(readCottageCache("stale-player")).toEqual(cloud);
  });

  it("reconnect-save unions cloud purchases into a higher-revision offline save", async () => {
    const cloud = makeSave(4, NOW - 20);
    cloud.inventory.toys.push("ball");
    cloud.inventory.outfits.push("strawberry-clip");
    cloud.inventory.furniture.push("lamp");
    cloud.inventory.wallpapers.push("starry-night");
    cloud.inventory.floors.push("cloud-carpet");

    const offline = makeSave(8, NOW - 10);
    offline.stats.mood = 67;
    offline.inventory.toys.push("frisbee");
    const transaction = transactionFor({
      ...cloud,
      createdAt: "cloud-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await saveCottageCloud(
      "reconnect-player",
      offline,
      localStorage,
      NOW,
    );

    expect(committed.revision).toBe(8);
    expect(committed.stats.mood).toBe(67);
    expect(committed.inventory.toys).toEqual(["frisbee", "ball"]);
    expect(committed.inventory.outfits).toContain("strawberry-clip");
    expect(committed.inventory.furniture).toContain("lamp");
    expect(committed.inventory.wallpapers).toContain("starry-night");
    expect(committed.inventory.floors).toContain("cloud-carpet");
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        inventory: expect.objectContaining({
          toys: ["frisbee", "ball"],
          outfits: ["strawberry-clip"],
        }),
        createdAt: "cloud-created-at",
        updatedAt: serverTimestampMarker,
      }),
    );
    expect(readCottageCache("reconnect-player")).toEqual(committed);
  });

  it("reads shared coins and treats missing or malformed balances as zero", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValueOnce(
      snapshot({ coins: 123.9 }),
    );
    await expect(loadCottageCoins("player-1")).resolves.toBe(123);
    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      mockDb,
      "gameProgress",
      "player-1",
    );

    firestoreMocks.getDocFromServer.mockResolvedValueOnce(
      snapshot({ coins: -2 }),
    );
    await expect(loadCottageCoins("negative-player")).resolves.toBe(0);

    firestoreMocks.getDocFromServer.mockResolvedValueOnce(snapshot(null));
    await expect(loadCottageCoins("new-player")).resolves.toBe(0);
  });
});

describe("purchaseCottageProduct", () => {
  it.each([
    ["snack", "apple", 15],
    ["toy", "ball", 60],
    ["outfit", "strawberry-clip", 120],
    ["furniture", "lamp", 80],
    ["wallpaper", "starry-night", 200],
    ["floor", "cloud-carpet", 200],
  ] as const)(
    "atomically purchases the canonical %s catalog item",
    async (kind, productId, price) => {
      const transaction = transactionFor(makeSave(2, NOW - 1), {
        coins: 500,
      });
      firestoreMocks.runTransaction.mockImplementation(
        async (_database, update) => update(transaction),
      );

      const committed = await purchaseCottageProduct(
        `buyer-${kind}`,
        productId,
        localStorage,
        NOW,
      );

      expect(committed.product).toMatchObject({ kind, id: productId, price });
      expect(committed.coinsAfter).toBe(500 - price);
      switch (kind) {
        case "snack":
          expect(committed.save.inventory.snacks.apple).toBe(1);
          break;
        case "toy":
          expect(committed.save.inventory.toys).toContain("ball");
          break;
        case "outfit":
          expect(committed.save.inventory.outfits).toContain(
            "strawberry-clip",
          );
          break;
        case "furniture":
          expect(committed.save.inventory.furniture).toContain("lamp");
          break;
        case "wallpaper":
          expect(committed.save.inventory.wallpapers).toContain(
            "starry-night",
          );
          break;
        case "floor":
          expect(committed.save.inventory.floors).toContain("cloud-carpet");
          break;
      }
      expect(transaction.update).toHaveBeenCalledWith(progressRef, {
        coins: 500 - price,
        updatedAt: serverTimestampMarker,
      });
      expect(transaction.set.mock.calls[0]).toHaveLength(2);
    },
  );

  it("atomically charges the catalog price and adds a snack", async () => {
    const current = {
      ...makeSave(2, NOW - 1),
      createdAt: "original-created-at",
    };
    const transaction = transactionFor(current, { coins: 100 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await purchaseCottageProduct(
      "buyer",
      "cloud-cake",
      localStorage,
      NOW,
    );

    expect(committed.product).toMatchObject({
      id: "cloud-cake",
      kind: "snack",
      price: 40,
    });
    expect(committed.coinsAfter).toBe(60);
    expect(committed.save.inventory.snacks["cloud-cake"]).toBe(1);
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        revision: 3,
        inventory: expect.objectContaining({
          snacks: { "cloud-cake": 1 },
        }),
        createdAt: "original-created-at",
        updatedAt: serverTimestampMarker,
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(progressRef, {
      coins: 60,
      updatedAt: serverTimestampMarker,
    });
    expect(readCottageCache("buyer")).toEqual(committed.save);
    expect(readCottageCache("buyer")).not.toHaveProperty("updatedAt");
  });

  it("uses a fresher optimistic cache as the transaction base", async () => {
    const cloud = makeSave(2, NOW - 20);
    const cached = {
      ...makeSave(4, NOW - 10),
      stats: { ...cloud.stats, mood: 77 },
      inventory: {
        ...cloud.inventory,
        snacks: { apple: 2 },
        outfits: ["strawberry-clip"] as PetSaveV1["inventory"]["outfits"],
        furniture: ["cloud-bed", "lamp"] as PetSaveV1["inventory"]["furniture"],
        wallpapers: ["cloud-blue", "starry-night"] as PetSaveV1["inventory"]["wallpapers"],
        floors: ["cream-wood", "cloud-carpet"] as PetSaveV1["inventory"]["floors"],
      },
      equipped: { head: "strawberry-clip" as const },
      room: {
        wallpaperId: "starry-night" as const,
        floorId: "cloud-carpet" as const,
        placed: [
          { id: "cloud-bed" as const, x: 76, y: 68, zone: "floor" as const },
          { id: "lamp" as const, x: 25, y: 70, zone: "floor" as const },
        ],
      },
    };
    await writeCottageCache("optimistic-buyer", cached);
    const transaction = transactionFor(cloud, { coins: 100 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await purchaseCottageProduct(
      "optimistic-buyer",
      "ball",
      localStorage,
      NOW,
    );

    expect(committed.save.revision).toBe(5);
    expect(committed.save.stats.mood).toBe(77);
    expect(committed.save.inventory.snacks).toEqual({ apple: 2 });
    expect(committed.save.inventory.toys).toContain("ball");
    expect(committed.save.equipped).toEqual({ head: "strawberry-clip" });
    expect(committed.save.room).toEqual(cached.room);
    expect(committed.coinsAfter).toBe(40);
  });

  it("uses fresher cloud state without dropping stale-cache ownership", async () => {
    const staleCache = {
      ...makeSave(4, NOW - 10),
      stats: { ...makeSave().stats, mood: 61 },
      inventory: {
        ...makeSave().inventory,
        furniture: ["cloud-bed", "lamp"] as PetSaveV1["inventory"]["furniture"],
      },
    };
    const cloud = {
      ...makeSave(5, NOW - 5),
      stats: { ...makeSave().stats, mood: 88 },
    };
    await writeCottageCache("cloud-wins", staleCache);
    const transaction = transactionFor(cloud, { coins: 500 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await purchaseCottageProduct(
      "cloud-wins",
      "cloud-carpet",
      localStorage,
      NOW,
    );

    expect(committed.save.revision).toBe(6);
    expect(committed.save.stats.mood).toBe(88);
    expect(committed.save.inventory.furniture).toContain("lamp");
    expect(committed.save.inventory.floors).toContain("cloud-carpet");
  });

  it("does not charge again when a higher-revision stale cache misses a cloud purchase", async () => {
    const cloud = makeSave(4, NOW - 20);
    cloud.inventory.toys = ["ball"];
    const staleCache = makeSave(9, NOW - 10);
    await writeCottageCache("divergent-owner", staleCache);

    const transaction = transactionFor(cloud, { coins: 500 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    await expect(
      purchaseCottageProduct(
        "divergent-owner",
        "ball",
        localStorage,
        NOW,
      ),
    ).rejects.toMatchObject({
      code: COTTAGE_ALREADY_OWNED,
      productId: "ball",
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("backfills earned gifts inside the same atomic purchase snapshot", async () => {
    const legacy = makeSave(6, NOW - 1);
    legacy.bond = {
      total: 1_190,
      earnedToday: 0,
      earnedDate: LOCAL_DATE,
    };
    legacy.inventory.outfits = [];
    legacy.inventory.furniture = ["cloud-bed"];
    const transaction = transactionFor(legacy, { coins: 100 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await purchaseCottageProduct(
      "legacy-shopper",
      "apple",
      localStorage,
      NOW,
    );

    expect(committed.coinsAfter).toBe(85);
    expect(committed.save.inventory.outfits).toContain("golden-bow");
    expect(committed.save.inventory.furniture).toEqual(
      expect.arrayContaining([
        "flower-gift",
        "clover-plant",
        "star-hanging",
        "rainbow-picture",
      ]),
    );
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        inventory: expect.objectContaining({
          outfits: expect.arrayContaining(["golden-bow"]),
        }),
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(progressRef, {
      coins: 85,
      updatedAt: serverTimestampMarker,
    });
  });

  it("throws a typed insufficient-coins error and writes nothing", async () => {
    const transaction = transactionFor(makeSave(), { coins: 39 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const promise = purchaseCottageProduct(
      "poor-player",
      "cloud-cake",
      localStorage,
      NOW,
    );

    await expect(promise).rejects.toBeInstanceOf(
      CottageInsufficientCoinsError,
    );
    await promise.catch((error: unknown) => {
      expect(isCottageInsufficientCoinsError(error)).toBe(true);
      expect(error).toMatchObject({
        code: COTTAGE_INSUFFICIENT_COINS,
        requiredCoins: 40,
        availableCoins: 39,
      });
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
    expect(readCottageCache("poor-player")).toBeNull();
  });

  it("throws a typed already-owned error for permanent items", async () => {
    const save = makeSave();
    save.inventory.toys = ["ball"];
    const transaction = transactionFor(save, { coins: 500 });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const promise = purchaseCottageProduct(
      "collector",
      "ball",
      localStorage,
      NOW,
    );

    await expect(promise).rejects.toBeInstanceOf(CottageAlreadyOwnedError);
    await promise.catch((error: unknown) => {
      expect(isCottageAlreadyOwnedError(error)).toBe(true);
      expect(error).toMatchObject({
        code: COTTAGE_ALREADY_OWNED,
        productId: "ball",
      });
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it.each([
    ["toy", "ball"],
    ["outfit", "strawberry-clip"],
    ["furniture", "lamp"],
    ["wallpaper", "starry-night"],
    ["floor", "cloud-carpet"],
  ] as const)(
    "rejects a duplicate permanent %s without charging coins",
    async (kind, productId) => {
      const save = makeSave();
      switch (kind) {
        case "toy":
          save.inventory.toys = ["ball"];
          break;
        case "outfit":
          save.inventory.outfits = ["strawberry-clip"];
          break;
        case "furniture":
          save.inventory.furniture.push("lamp");
          break;
        case "wallpaper":
          save.inventory.wallpapers.push("starry-night");
          break;
        case "floor":
          save.inventory.floors.push("cloud-carpet");
          break;
      }
      const transaction = transactionFor(save, { coins: 500 });
      firestoreMocks.runTransaction.mockImplementation(
        async (_database, update) => update(transaction),
      );

      await expect(
        purchaseCottageProduct(
          `owner-${kind}`,
          productId,
          localStorage,
          NOW,
        ),
      ).rejects.toMatchObject({
        code: COTTAGE_ALREADY_OWNED,
        productId,
      });
      expect(transaction.set).not.toHaveBeenCalled();
      expect(transaction.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    "golden-bow",
    "flower-gift",
    "cloud-bed",
    "cloud-blue",
    "cream-wood",
  ])("never exposes gift/default item %s as a purchasable product", async (id) => {
    await expect(
      purchaseCottageProduct("catalog-guard", id, localStorage, NOW),
    ).rejects.toThrow("Unknown Cloud Cottage product");
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects unknown products before starting a transaction", async () => {
    await expect(
      purchaseCottageProduct(
        "buyer",
        "caller-priced-fake-item",
        localStorage,
        NOW,
      ),
    ).rejects.toThrow("Unknown Cloud Cottage product");
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it("does not update the cache when the transaction fails", async () => {
    const cached = makeSave(2, NOW);
    await writeCottageCache("offline-buyer", cached);
    firestoreMocks.runTransaction.mockRejectedValue(new Error("unavailable"));

    await expect(
      purchaseCottageProduct(
        "offline-buyer",
        "apple",
        localStorage,
        NOW,
      ),
    ).rejects.toThrow("unavailable");
    expect(readCottageCache("offline-buyer")).toEqual(cached);
  });
});

describe("commitCottageCareAction", () => {
  it("persists newly earned bond gifts in the same care transaction", async () => {
    const base = makeSave(2, NOW - 1);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, mood: 70 },
      bond: {
        total: 138,
        earnedToday: 0,
        earnedDate: LOCAL_DATE,
      },
      wish: {
        date: LOCAL_DATE,
        wishId: "bubble-bath",
        fulfilled: false,
        progress: 0,
        target: 1,
      },
    };
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "level-up-player",
      { type: "pet" },
      NOW,
      localStorage,
    );

    expect(committed.save.bond.total).toBe(140);
    expect(committed.save.inventory.furniture).toContain("flower-gift");
    expect(committed.grantedGifts).toEqual([
      { level: 5, kind: "furniture", id: "flower-gift" },
    ]);
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        inventory: expect.objectContaining({
          furniture: expect.arrayContaining(["flower-gift"]),
        }),
      }),
    );
  });

  it("atomically consumes a premium snack and applies its wish reward", async () => {
    const base = makeSave(3, NOW - 1);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, fullness: 20 },
      inventory: {
        ...base.inventory,
        snacks: { apple: 2 },
      },
      wish: {
        date: LOCAL_DATE,
        wishId: "eat-apple",
        fulfilled: false,
        progress: 0,
        target: 1,
      },
    };
    const transaction = transactionFor({
      ...current,
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "snack-player",
      { type: "feed", foodId: "apple" },
      NOW,
      localStorage,
    );

    expect(committed.applied).toBe(true);
    expect(committed.save.inventory.snacks.apple).toBe(1);
    expect(committed.save.wish.fulfilled).toBe(true);
    expect(committed.wishBondAwarded).toBe(10);
    expect(committed.totalBondAwarded).toBe(16);
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        inventory: expect.objectContaining({ snacks: { apple: 1 } }),
        wish: expect.objectContaining({ fulfilled: true }),
        createdAt: "original-created-at",
        updatedAt: serverTimestampMarker,
      }),
    );
    expect(transaction.update).not.toHaveBeenCalled();
    expect(readCottageCache("snack-player")).toEqual(committed.save);
  });

  it("replaces the canonical snapshot so a consumed snack key cannot revive", async () => {
    const base = makeSave(4, NOW - 1);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, fullness: 20 },
      inventory: {
        ...base.inventory,
        snacks: { apple: 1, pudding: 1 },
      },
    };
    const transaction = transactionFor({
      ...current,
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "last-apple-player",
      { type: "feed", foodId: "apple" },
      NOW,
      localStorage,
    );

    expect(committed.save.inventory.snacks).toEqual({ pudding: 1 });
    const [, envelope, options] = transaction.set.mock.calls[0];
    expect((envelope as PetSaveV1).inventory.snacks).toEqual({ pudding: 1 });
    expect(options).toBeUndefined();
  });

  it("atomically consumes free food without touching the coin document", async () => {
    const base = makeSave(1, NOW - 1);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, fullness: 20 },
      freeFood: { ...base.freeFood, milk: 2 },
      wish: {
        date: LOCAL_DATE,
        wishId: "pet-five",
        fulfilled: false,
        progress: 0,
        target: 5,
      },
    };
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "milk-player",
      { type: "feed", foodId: "milk" },
      NOW,
      localStorage,
    );

    expect(committed.applied).toBe(true);
    expect(committed.save.freeFood.milk).toBe(1);
    expect(transaction.get).toHaveBeenCalledTimes(1);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("uses the same transaction helper for non-inventory care", async () => {
    const base = makeSave(2, NOW - 1);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, clean: 30 },
      wish: {
        date: LOCAL_DATE,
        wishId: "bubble-bath",
        fulfilled: false,
        progress: 0,
        target: 1,
      },
    };
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "bath-player",
      { type: "bath" },
      NOW,
      localStorage,
    );

    expect(committed.applied).toBe(true);
    expect(committed.save.stats.clean).toBe(100);
    expect(committed.save.wish.fulfilled).toBe(true);
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });

  it("reconciles a fresher cached save before consuming inventory", async () => {
    const cloudBase = makeSave(1, NOW - 20);
    const cloud = {
      ...cloudBase,
      stats: { ...cloudBase.stats, fullness: 20 },
    };
    const cached: PetSaveV1 = {
      ...cloud,
      revision: 3,
      clientUpdatedAt: NOW - 10,
      inventory: {
        ...cloud.inventory,
        snacks: { pudding: 2 },
      },
    };
    await writeCottageCache("cached-care", cached);
    const transaction = transactionFor(cloud);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "cached-care",
      { type: "feed", foodId: "pudding" },
      NOW,
      localStorage,
    );

    expect(committed.save.revision).toBe(4);
    expect(committed.save.inventory.snacks.pudding).toBe(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });

  it("does not consume or write when a full pet refuses food", async () => {
    const base = makeSave(4, NOW);
    const current: PetSaveV1 = {
      ...base,
      stats: { ...base.stats, fullness: 100 },
      inventory: {
        ...base.inventory,
        snacks: { apple: 1 },
      },
      wish: {
        date: LOCAL_DATE,
        wishId: "pet-five",
        fulfilled: false,
        progress: 0,
        target: 5,
      },
    };
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "full-player",
      { type: "feed", foodId: "apple" },
      NOW,
      localStorage,
    );

    expect(committed).toMatchObject({ applied: false, reason: "full" });
    expect(committed.save.inventory.snacks.apple).toBe(1);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("persists unioned permanent ownership during a divergent care rebase", async () => {
    const cloud = makeSave(3, NOW - 20);
    cloud.stats.clean = 25;
    cloud.inventory.toys.push("ball");
    cloud.inventory.outfits.push("strawberry-clip");
    cloud.inventory.furniture.push("lamp");
    cloud.inventory.wallpapers.push("starry-night");
    cloud.inventory.floors.push("cloud-carpet");

    const cached = makeSave(7, NOW - 10);
    cached.stats.clean = 30;
    cached.inventory.toys.push("frisbee");
    cached.inventory.outfits.push("sailor-hat");
    cached.inventory.furniture.push("plant");
    cached.inventory.wallpapers.push("candy-stripes");
    cached.inventory.floors.push("frosting-check");
    await writeCottageCache("divergent-care", cached);

    const transaction = transactionFor(cloud);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottageCareAction(
      "divergent-care",
      { type: "bath" },
      NOW,
      localStorage,
    );

    expect(committed.save.stats.clean).toBe(100);
    expect(committed.save.inventory.toys).toEqual(["frisbee", "ball"]);
    expect(committed.save.inventory.outfits).toEqual([
      "sailor-hat",
      "strawberry-clip",
    ]);
    expect(committed.save.inventory.furniture).toEqual(
      expect.arrayContaining(["cloud-bed", "plant", "lamp"]),
    );
    expect(committed.save.inventory.wallpapers).toEqual(
      expect.arrayContaining(["cloud-blue", "candy-stripes", "starry-night"]),
    );
    expect(committed.save.inventory.floors).toEqual(
      expect.arrayContaining(["cream-wood", "frosting-check", "cloud-carpet"]),
    );
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });
});

describe("commitCottagePersonalizationAction", () => {
  it("reconciles an already-applied optimistic outfit without applying it twice", async () => {
    const cloud = makeSave(1, NOW - 20);
    cloud.inventory.outfits = ["strawberry-clip"];
    const optimistic: PetSaveV1 = {
      ...cloud,
      revision: 2,
      clientUpdatedAt: NOW - 10,
      equipped: { head: "strawberry-clip" },
    };
    await writeCottageCache("optimistic-outfit", optimistic);
    const transaction = transactionFor(cloud);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationAction(
      "optimistic-outfit",
      { type: "equip-outfit", outfitId: "strawberry-clip" },
      NOW,
      localStorage,
    );

    expect(committed).toMatchObject({
      applied: false,
      reason: "already-equipped",
      save: {
        revision: 2,
        equipped: { head: "strawberry-clip" },
      },
    });
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({ equipped: { head: "strawberry-clip" } }),
    );
    expect(readCottageCache("optimistic-outfit")).toEqual(committed.save);
  });

  it("unequips with a full snapshot so the removed slot cannot resurrect", async () => {
    const current = makeSave(2, NOW - 1);
    current.inventory.outfits = ["strawberry-clip", "red-ribbon"];
    current.equipped = {
      head: "strawberry-clip",
      neck: "red-ribbon",
    };
    const transaction = transactionFor({
      ...current,
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationAction(
      "unequip-player",
      { type: "unequip-outfit", slot: "head" },
      NOW,
      localStorage,
    );

    expect(committed.applied).toBe(true);
    expect(committed.save.equipped).toEqual({ neck: "red-ribbon" });
    const [, envelope, options] = transaction.set.mock.calls[0];
    expect((envelope as PetSaveV1).equipped).toEqual({
      neck: "red-ribbon",
    });
    expect(options).toBeUndefined();
  });

  it.each([
    ["wallpaper", "starry-night"],
    ["floor", "cloud-carpet"],
  ] as const)("selects an owned %s transactionally", async (surface, id) => {
    const current = makeSave(2, NOW - 1);
    if (surface === "wallpaper") {
      current.inventory.wallpapers.push("starry-night");
    } else {
      current.inventory.floors.push("cloud-carpet");
    }
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const action =
      surface === "wallpaper"
        ? ({ type: "select-wallpaper", wallpaperId: id } as const)
        : ({ type: "select-floor", floorId: id } as const);
    const committed = await commitCottagePersonalizationAction(
      `surface-${surface}`,
      action,
      NOW,
      localStorage,
    );

    expect(committed.applied).toBe(true);
    expect(
      surface === "wallpaper"
        ? committed.save.room.wallpaperId
        : committed.save.room.floorId,
    ).toBe(id);
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });

  it("round-trips canonical placement coordinates and order through cloud load", async () => {
    const current = makeSave(2, NOW - 1);
    current.inventory.furniture.push("lamp", "picture");
    const transaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationAction(
      "room-round-trip",
      {
        type: "add-furniture",
        furnitureId: "lamp",
        x: 120,
        y: -5,
        zone: "floor",
      },
      NOW,
      localStorage,
    );

    expect(committed.save.room.placed).toEqual([
      { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
      { id: "lamp", x: 100, y: 0, zone: "floor" },
    ]);
    localStorage.clear();
    firestoreMocks.getDocFromServer.mockResolvedValue(
      snapshot({
        ...committed.save,
        createdAt: "original-created-at",
        updatedAt: serverTimestampMarker,
      }),
    );

    const reloaded = await loadCottageCloud(
      "room-round-trip",
      localStorage,
      NOW,
    );

    expect(reloaded.room.placed).toEqual(committed.save.room.placed);
    expect(readCottageCache("room-round-trip")?.room.placed).toEqual(
      committed.save.room.placed,
    );
  });

  it("moves and removes placements without nested merge resurrection", async () => {
    const current = makeSave(3, NOW - 2);
    current.inventory.furniture.push("lamp");
    current.room.placed.push({
      id: "lamp",
      x: 10,
      y: 20,
      zone: "floor",
    });
    const moveTransaction = transactionFor(current);
    firestoreMocks.runTransaction.mockImplementationOnce(
      async (_database, update) => update(moveTransaction),
    );

    const moved = await commitCottagePersonalizationAction(
      "move-remove-player",
      {
        type: "move-furniture",
        furnitureId: "lamp",
        x: 33.333,
        y: 44.444,
      },
      NOW - 1,
      localStorage,
    );
    expect(moved.save.room.placed.at(-1)).toEqual({
      id: "lamp",
      x: 33.33,
      y: 44.44,
      zone: "floor",
    });

    const removeTransaction = transactionFor({
      ...moved.save,
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementationOnce(
      async (_database, update) => update(removeTransaction),
    );
    const removed = await commitCottagePersonalizationAction(
      "move-remove-player",
      { type: "remove-furniture", furnitureId: "lamp" },
      NOW,
      localStorage,
    );

    expect(removed.save.room.placed).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "lamp" })]),
    );
    const [, envelope, options] = removeTransaction.set.mock.calls[0];
    expect((envelope as PetSaveV1).room.placed).toEqual([
      { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
    ]);
    expect(options).toBeUndefined();
    expect(readCottageCache("move-remove-player")?.room.placed).toEqual(
      removed.save.room.placed,
    );
  });

  it("uses fresher cloud state while retaining stale-cache ownership", async () => {
    const stale = makeSave(4, NOW - 10);
    stale.inventory.furniture.push("lamp");
    stale.inventory.floors.push("cloud-carpet");
    stale.room.floorId = "cloud-carpet";
    await writeCottageCache("personalization-cloud-wins", stale);

    const cloud = makeSave(5, NOW - 5);
    cloud.inventory.floors.push("frosting-check");
    const transaction = transactionFor(cloud);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationAction(
      "personalization-cloud-wins",
      { type: "select-floor", floorId: "frosting-check" },
      NOW,
      localStorage,
    );

    expect(committed.save.revision).toBe(6);
    expect(committed.save.room.floorId).toBe("frosting-check");
    expect(committed.save.inventory.furniture).toContain("lamp");
    expect(committed.save.inventory.floors).toContain("cloud-carpet");
  });

  it("persists all retroactive bond gifts even when the action is a no-op", async () => {
    const legacy = makeSave(8, NOW - 1);
    legacy.bond = {
      total: 1_890,
      earnedToday: 0,
      earnedDate: LOCAL_DATE,
    };
    legacy.inventory.outfits = [];
    legacy.inventory.furniture = ["cloud-bed"];
    const transaction = transactionFor({
      ...legacy,
      createdAt: "original-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationAction(
      "legacy-gifts",
      { type: "unequip-outfit", slot: "head" },
      NOW,
      localStorage,
    );

    expect(committed).toMatchObject({
      applied: false,
      reason: "not-equipped",
    });
    expect(committed.save.inventory.outfits).toContain("golden-bow");
    expect(committed.save.inventory.furniture).toEqual(
      expect.arrayContaining([
        "flower-gift",
        "clover-plant",
        "star-hanging",
        "rainbow-picture",
        "cloud-frame",
      ]),
    );
    expect(transaction.set).toHaveBeenCalledWith(
      cottageRef,
      expect.objectContaining({
        inventory: expect.objectContaining({
          outfits: expect.arrayContaining(["golden-bow"]),
          furniture: expect.arrayContaining(["cloud-frame"]),
        }),
      }),
    );
    expect(readCottageCache("legacy-gifts")).toEqual(committed.save);
  });
});

describe("commitCottagePersonalizationActions", () => {
  it("commits an ordered room edit and same-position z-order as one exact write", async () => {
    const cloud = makeSave(8, NOW - 20);
    cloud.inventory.toys.push("ball");
    cloud.inventory.outfits.push("sailor-hat");
    cloud.inventory.furniture.push("plant");
    cloud.inventory.wallpapers.push("candy-stripes");
    cloud.inventory.floors.push("frosting-check");
    const cached = makeSave(10, NOW - 10);
    cached.inventory.outfits = ["strawberry-clip", "red-ribbon"];
    cached.inventory.furniture = ["cloud-bed", "lamp", "picture", "sofa"];
    cached.inventory.wallpapers = ["cloud-blue", "starry-night"];
    cached.inventory.floors = ["cream-wood", "cloud-carpet"];
    cached.equipped = { neck: "red-ribbon" };

    let cacheValue: string | null = JSON.stringify(cached);
    const cacheStorage = {
      getItem: vi.fn(() => cacheValue),
      setItem: vi.fn((_key: string, value: string) => {
        cacheValue = value;
      }),
    };
    const transaction = transactionFor({
      ...cloud,
      createdAt: "cloud-created-at",
    });
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationActions(
      "room-batch-player",
      [
        { type: "equip-outfit", outfitId: "strawberry-clip" },
        { type: "unequip-outfit", slot: "neck" },
        { type: "select-wallpaper", wallpaperId: "starry-night" },
        { type: "select-floor", floorId: "cloud-carpet" },
        {
          type: "add-furniture",
          furnitureId: "lamp",
          x: 20,
          y: 70,
        },
        {
          type: "add-furniture",
          furnitureId: "picture",
          x: 15,
          y: 20,
        },
        {
          type: "add-furniture",
          furnitureId: "sofa",
          x: 60,
          y: 75,
        },
        {
          type: "move-furniture",
          furnitureId: "lamp",
          x: 20.01,
          y: 70,
        },
        {
          type: "move-furniture",
          furnitureId: "lamp",
          x: 20,
          y: 70,
        },
      ],
      NOW,
      cacheStorage,
    );

    const expectedRoom: PetSaveV1["room"] = {
      wallpaperId: "starry-night",
      floorId: "cloud-carpet",
      placed: [
        { id: "cloud-bed", x: 76, y: 68, zone: "floor" },
        { id: "picture", x: 15, y: 20, zone: "wall" },
        { id: "sofa", x: 60, y: 75, zone: "floor" },
        { id: "lamp", x: 20, y: 70, zone: "floor" },
      ],
    };
    expect(committed).toMatchObject({
      applied: true,
      grantedGifts: [],
      save: {
        revision: 19,
        equipped: { head: "strawberry-clip" },
        room: expectedRoom,
      },
    });
    expect(transaction.get).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(committed.save.inventory.toys).toContain("ball");
    expect(committed.save.inventory.outfits).toEqual(
      expect.arrayContaining(["strawberry-clip", "red-ribbon", "sailor-hat"]),
    );
    expect(committed.save.inventory.furniture).toContain("plant");
    expect(committed.save.inventory.wallpapers).toContain("candy-stripes");
    expect(committed.save.inventory.floors).toContain("frosting-check");
    const [writtenRef, envelope, options] = transaction.set.mock.calls[0];
    expect(writtenRef).toBe(cottageRef);
    expect(envelope).toMatchObject({
      revision: 19,
      equipped: { head: "strawberry-clip" },
      room: expectedRoom,
      createdAt: "cloud-created-at",
      updatedAt: serverTimestampMarker,
    });
    expect(options).toBeUndefined();
    expect(cacheStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(cacheValue ?? "null")).toMatchObject({
      revision: 19,
      equipped: { head: "strawberry-clip" },
      room: expectedRoom,
    });
  });

  it("returns each retroactive gift once across the whole ordered batch", async () => {
    const legacy = makeSave(8, NOW - 1);
    legacy.bond = {
      total: 1_890,
      earnedToday: 0,
      earnedDate: LOCAL_DATE,
    };
    legacy.inventory.outfits = [];
    legacy.inventory.furniture = ["cloud-bed"];
    const transaction = transactionFor(legacy);
    firestoreMocks.runTransaction.mockImplementation(
      async (_database, update) => update(transaction),
    );

    const committed = await commitCottagePersonalizationActions(
      "legacy-batch-gifts",
      [
        { type: "unequip-outfit", slot: "head" },
        { type: "unequip-outfit", slot: "neck" },
      ],
      NOW,
      localStorage,
    );

    const giftKeys = committed.grantedGifts.map(
      (gift) => `${gift.kind}:${gift.id}`,
    );
    expect(committed.applied).toBe(false);
    expect(giftKeys).toEqual([
      "furniture:flower-gift",
      "furniture:clover-plant",
      "furniture:star-hanging",
      "furniture:rainbow-picture",
      "outfit:golden-bow",
      "furniture:cloud-frame",
    ]);
    expect(new Set(giftKeys).size).toBe(giftKeys.length);
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(readCottageCache("legacy-batch-gifts")).toEqual(committed.save);
  });

  it("treats an empty batch as a cache-only no-op", async () => {
    const cached = makeSave(12, NOW - 1);
    let cacheValue: string | null = JSON.stringify(cached);
    const cacheStorage = {
      getItem: vi.fn(() => cacheValue),
      setItem: vi.fn((_key: string, value: string) => {
        cacheValue = value;
      }),
    };

    const committed = await commitCottagePersonalizationActions(
      "empty-room-batch",
      [],
      NOW,
      cacheStorage,
    );

    expect(committed).toEqual({
      save: cached,
      applied: false,
      grantedGifts: [],
    });
    expect(firestoreMocks.doc).not.toHaveBeenCalled();
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(cacheStorage.getItem).toHaveBeenCalledTimes(1);
    expect(cacheStorage.setItem).not.toHaveBeenCalled();
  });
});
