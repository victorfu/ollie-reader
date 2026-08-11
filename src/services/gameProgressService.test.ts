import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  deleteField: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
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
  getDailyTokenBonusPreview,
  getOrCreateProgress,
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

function storedProgress(overrides: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_PLAYER_PROGRESS,
    odl: "player-1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function settlementTransaction(progress: Record<string, unknown> | null) {
  return {
    get: vi.fn(() => Promise.resolve(snapshot(progress))),
    set: vi.fn(),
    update: vi.fn(),
  };
}

function settlementReceipt(
  settlementId: string,
  resetVersion: number,
  didLevelUp = false,
  isNewHighScore = false,
) {
  return { settlementId, resetVersion, didLevelUp, isNewHighScore };
}

function setServerTime(millis: number, data: Record<string, unknown> = {}) {
  firestoreMocks.getDocFromServer.mockResolvedValue(
    snapshot({
      ...data,
      dailyClaimServerClock: { toMillis: () => millis },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.doc.mockReturnValue(progressRef);
  firestoreMocks.deleteField.mockReturnValue(deleteMarker);
  firestoreMocks.serverTimestamp.mockReturnValue(timestampMarker);
});

describe("game progress creation and migration", () => {
  it("starts new or reset progress with no free gacha tokens", () => {
    expect(DEFAULT_PLAYER_PROGRESS.coins).toBe(0);
  });

  it("drops legacy spirit data and backfills a missing token balance", async () => {
    firestoreMocks.getDoc.mockResolvedValue(
      snapshot(
        storedProgress({
          coins: undefined,
          unlockedSpiritIds: ["cloud-puff"],
          evolvedSpiritIds: ["cloud-puff"],
          elementProgress: { normal: 12 },
          adventureSettlementReceipts: [settlementReceipt("old", 0)],
        }),
      ),
    );

    const progress = await fetchProgress("player-1");

    expect(progress?.coins).toBe(0);
    expect(progress).not.toHaveProperty("unlockedSpiritIds");
    expect(progress).not.toHaveProperty("evolvedSpiritIds");
    expect(progress).not.toHaveProperty("elementProgress");
    expect(progress).not.toHaveProperty("adventureSettlementReceipts");
  });

  it("creates progress inside the same transaction as the existence check", async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot(null));
    const transaction = settlementTransaction(null);
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    const progress = await getOrCreateProgress("player-1");

    expect(progress.coins).toBe(0);
    expect(transaction.set).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        odl: "player-1",
        coins: 0,
        createdAt: timestampMarker,
        updatedAt: timestampMarker,
      }),
    );
  });

  it("returns a concurrently-created document without overwriting it", async () => {
    firestoreMocks.getDoc.mockResolvedValue(snapshot(null));
    const transaction = settlementTransaction(
      storedProgress({ coins: 75, exp: 140, totalQuizCompleted: 2 }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    const progress = await getOrCreateProgress("player-1");

    expect(progress.coins).toBe(75);
    expect(progress.exp).toBe(140);
    expect(progress.totalQuizCompleted).toBe(2);
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("uses an existing cached document without requiring an online transaction", async () => {
    firestoreMocks.getDoc.mockResolvedValue(
      snapshot(storedProgress({ coins: 12, exp: 50 })),
    );

    const progress = await getOrCreateProgress("player-1");

    expect(progress.coins).toBe(12);
    expect(progress.exp).toBe(50);
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });
});

describe("adventure settlement transactions", () => {
  it("merges a victory into the latest stored progress without regression", async () => {
    const transaction = settlementTransaction(
      storedProgress({
        level: 1,
        exp: 90,
        currentStageIndex: 5,
        totalQuizCompleted: 7,
        highestCombo: 4,
        totalBossDefeated: 2,
        resetVersion: 2,
        coins: 40,
      }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(
      saveProgressWithTokenReward(
        "player-1",
        {
          settlementId: "run-a",
          outcome: "victory",
          stageIndex: 1,
          expGained: 50,
          maxCombo: 3,
          bossDefeated: false,
        },
        25,
        2,
      ),
    ).resolves.toEqual({
      tokenBalance: 65,
      progress: {
        level: 2,
        exp: 140,
        expToNextLevel: 110,
        currentStageIndex: 5,
        totalQuizCompleted: 8,
        highestCombo: 4,
        totalBossDefeated: 2,
        resetVersion: 2,
        coins: 65,
      },
      didLevelUp: true,
      isNewHighScore: false,
    });

    expect(transaction.update).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        exp: 140,
        currentStageIndex: 5,
        totalQuizCompleted: 8,
        highestCombo: 4,
        coins: 65,
        unlockedSpiritIds: deleteMarker,
        evolvedSpiritIds: deleteMarker,
        elementProgress: deleteMarker,
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        adventureSettlementReceipts: [
          settlementReceipt("run-a", 2, true, false),
        ],
      }),
    );
  });

  it("replays a receipt without applying rewards twice", async () => {
    const transaction = settlementTransaction(
      storedProgress({
        level: 2,
        exp: 200,
        currentStageIndex: 4,
        totalQuizCompleted: 3,
        highestCombo: 6,
        totalBossDefeated: 1,
        resetVersion: 2,
        coins: 90,
        adventureSettlementReceipts: [
          settlementReceipt("run-a", 2, true, true),
        ],
      }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    const result = await saveProgressWithTokenReward(
      "player-1",
      {
        settlementId: "run-a",
        outcome: "victory",
        stageIndex: 1,
        expGained: 50,
        maxCombo: 6,
        bossDefeated: false,
      },
      25,
      2,
    );

    expect(result.tokenBalance).toBe(90);
    expect(result.progress.exp).toBe(200);
    expect(result.progress.totalQuizCompleted).toBe(3);
    expect(result.didLevelUp).toBe(true);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("does not revive a receipt after the progress was reset", async () => {
    const transaction = settlementTransaction(
      storedProgress({
        resetVersion: 3,
        coins: 0,
        adventureSettlementReceipts: [
          settlementReceipt("run-a", 2, true, false),
        ],
      }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(
      saveProgressWithTokenReward(
        "player-1",
        { settlementId: "run-a", outcome: "defeat" },
        25,
        2,
      ),
    ).rejects.toBeInstanceOf(GameProgressResetConflictError);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("keeps the in-document receipt ledger bounded to the newest 128 entries", async () => {
    const oldReceipts = Array.from({ length: 128 }, (_, index) =>
      settlementReceipt(`run-${index}`, 2),
    );
    const transaction = settlementTransaction(
      storedProgress({
        resetVersion: 2,
        adventureSettlementReceipts: oldReceipts,
      }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await saveProgressWithTokenReward(
      "player-1",
      { settlementId: "run-new", outcome: "defeat" },
      0,
      2,
    );

    const write = transaction.update.mock.calls[0][1] as {
      adventureSettlementReceipts: ReturnType<typeof settlementReceipt>[];
    };
    expect(write.adventureSettlementReceipts).toHaveLength(128);
    expect(write.adventureSettlementReceipts[0].settlementId).toBe("run-1");
    expect(write.adventureSettlementReceipts.at(-1)?.settlementId).toBe(
      "run-new",
    );
    expect(transaction.set).not.toHaveBeenCalled();
    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      mockDb,
      "gameProgress",
      "player-1",
    );
    expect(firestoreMocks.doc).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid token reward of %s",
    async (reward) => {
      await expect(
        saveProgressWithTokenReward(
          "player-1",
          { settlementId: "run-a", outcome: "defeat" },
          reward,
          0,
        ),
      ).rejects.toBeInstanceOf(RangeError);
      expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    },
  );

  it("rejects a settlement created before another tab reset the game", async () => {
    const transaction = settlementTransaction(
      storedProgress({ resetVersion: 3 }),
    );
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(
      saveProgressWithTokenReward(
        "player-1",
        { settlementId: "run-a", outcome: "defeat" },
        25,
        2,
      ),
    ).rejects.toBeInstanceOf(GameProgressResetConflictError);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("increments the reset version while clearing progress and tokens", async () => {
    const transaction = settlementTransaction({ resetVersion: 4 });
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
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
    const resetWrite = transaction.set.mock.calls[0][1];
    expect(resetWrite).not.toHaveProperty("adventureSettlementReceipts");
  });
});

describe("daily gacha token claims", () => {
  const july21Taipei = Date.UTC(2026, 6, 20, 16, 0, 0);

  it("derives the preview date and reward from Firestore server time", async () => {
    setServerTime(july21Taipei, {
      streakDays: 2,
      lastDailyClaimDate: "2026-07-20",
    });

    await expect(getDailyTokenBonusPreview("player-1")).resolves.toEqual({
      claimDate: "2026-07-21",
      bonus: { eligible: true, coins: 30, streakDays: 3 },
    });
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(progressRef, {
      dailyClaimServerClock: timestampMarker,
    });
  });

  it("credits a server-computed claim in a transaction", async () => {
    setServerTime(july21Taipei);
    const transaction = settlementTransaction({
      coins: 80,
      streakDays: 2,
      lastDailyClaimDate: "2026-07-20",
    });
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(claimDailyTokenBonus("player-1")).resolves.toEqual({
      claimed: true,
      claimDate: "2026-07-21",
      tokenBalance: 110,
      streakDays: 3,
    });
    expect(transaction.update).toHaveBeenCalledWith(
      progressRef,
      expect.objectContaining({
        coins: 110,
        streakDays: 3,
        lastDailyClaimDate: "2026-07-21",
        lastLoginDate: "2026-07-21",
      }),
    );
  });

  it("does not credit a second claim for the server-derived date", async () => {
    setServerTime(july21Taipei);
    const transaction = settlementTransaction({
      coins: 100,
      streakDays: 3,
      lastDailyClaimDate: "2026-07-21",
    });
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(claimDailyTokenBonus("player-1")).resolves.toEqual({
      claimed: false,
      claimDate: "2026-07-21",
      tokenBalance: 100,
      streakDays: 3,
    });
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("rejects a claim when progress disappears before the transaction", async () => {
    setServerTime(july21Taipei);
    const transaction = settlementTransaction(null);
    firestoreMocks.runTransaction.mockImplementation((_db, callback) =>
      callback(transaction),
    );

    await expect(claimDailyTokenBonus("player-1")).rejects.toThrow(
      "Player progress does not exist.",
    );
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
