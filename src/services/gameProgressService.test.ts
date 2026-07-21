import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  deleteField: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));

vi.mock("firebase/firestore", () => ({
  ...firestoreMocks,
  Timestamp: class MockTimestamp {
    value: number;
    constructor(value: number) {
      this.value = value;
    }
    toMillis() {
      return this.value;
    }
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: mockDb }));

import {
  claimDailyTokenBonus,
  DEFAULT_PLAYER_PROGRESS,
  fetchProgress,
  GameProgressResetConflictError,
  resetGameProgress,
  saveProgressWithTokenReward,
} from "./gameProgressService";

const progressRef = { kind: "progress-document" };
const deleteMarker = { kind: "delete-field" };
const timestampMarker = { kind: "server-timestamp" };

function snapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.doc.mockReturnValue(progressRef);
  firestoreMocks.deleteField.mockReturnValue(deleteMarker);
  firestoreMocks.serverTimestamp.mockReturnValue(timestampMarker);
});

describe("game progress token migration", () => {
  it("starts new or reset progress with no free gacha tokens", () => {
    expect(DEFAULT_PLAYER_PROGRESS.coins).toBe(0);
  });

  it("drops legacy spirit data and backfills a missing token balance", async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot({
      ...DEFAULT_PLAYER_PROGRESS,
      odl: "player-1",
      coins: undefined,
      unlockedSpiritIds: ["cloud-puff"],
      evolvedSpiritIds: ["cloud-puff"],
      elementProgress: { normal: 12 },
    }));

    const progress = await fetchProgress("player-1");

    expect(progress?.coins).toBe(0);
    expect(progress).not.toHaveProperty("unlockedSpiritIds");
    expect(progress).not.toHaveProperty("evolvedSpiritIds");
    expect(progress).not.toHaveProperty("elementProgress");
  });

  it("awards tokens transactionally and deletes legacy fields", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot({
        coins: 40,
        resetVersion: 2,
      })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await expect(saveProgressWithTokenReward(
      "player-1",
      { level: 2, exp: 20 },
      25,
      2,
    )).resolves.toBe(65);

    expect(transaction.update).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        level: 2,
        exp: 20,
        coins: 65,
        unlockedSpiritIds: deleteMarker,
        evolvedSpiritIds: deleteMarker,
        elementProgress: deleteMarker,
        updatedAt: timestampMarker,
      }),
    );
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid token reward of %s",
    async (reward) => {
      await expect(
        saveProgressWithTokenReward("player-1", {}, reward, 0),
      ).rejects.toBeInstanceOf(RangeError);
      expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    },
  );

  it("rejects a settlement created before another tab reset the game", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot({
        coins: 0,
        resetVersion: 3,
      })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await expect(
      saveProgressWithTokenReward("player-1", { level: 8 }, 25, 2),
    ).rejects.toBeInstanceOf(GameProgressResetConflictError);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("increments the reset version while clearing progress and tokens", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot({ resetVersion: 4 })),
      set: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await resetGameProgress("player-1");

    expect(transaction.set).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        resetVersion: 5,
        coins: 0,
        level: 1,
        currentStageIndex: 0,
      }),
    );
  });
});

describe("daily gacha token claims", () => {
  it("credits the first claim in a transaction", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot({
        coins: 80,
        streakDays: 2,
        lastDailyClaimDate: "2026-07-20",
      })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await expect(
      claimDailyTokenBonus("player-1", "2026-07-21", 20, 3),
    ).resolves.toEqual({ claimed: true, tokenBalance: 100, streakDays: 3 });
    expect(transaction.update).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        coins: 100,
        streakDays: 3,
        lastDailyClaimDate: "2026-07-21",
        lastLoginDate: "2026-07-21",
      }),
    );
  });

  it("does not credit a second claim for the same date", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot({
        coins: 100,
        streakDays: 3,
        lastDailyClaimDate: "2026-07-21",
      })),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await expect(
      claimDailyTokenBonus("player-1", "2026-07-21", 20, 3),
    ).resolves.toEqual({ claimed: false, tokenBalance: 100, streakDays: 3 });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("rejects a claim when progress does not exist", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(snapshot(null)),
      update: vi.fn(),
    };
    firestoreMocks.runTransaction.mockImplementation(
      (_db, callback) => callback(transaction),
    );

    await expect(
      claimDailyTokenBonus("player-1", "2026-07-21", 20, 3),
    ).rejects.toThrow("Player progress does not exist.");
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
