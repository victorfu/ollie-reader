import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));
const serviceMocks = vi.hoisted(() => ({
  getOrCreateProgress: vi.fn(),
}));
const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../../../utils/firebaseUtil", () => ({ db: mockDb }));
vi.mock("../../../services/gameProgressService", () => serviceMocks);

import { LEVELS } from "./data/levels";
import {
  createEmptySave,
  saveCloud,
  settleCloudRunResult,
  syncCloudProgress,
  type SweetheartSaveV1,
} from "./storage";

type FakeRef = { path: string; firestore: typeof mockDb };
type FakeDoc = Record<string, unknown>;

const UID = "player-1";
const PROGRESS_PATH = `gameProgress/${UID}`;
const CAMPAIGN_PATH = `${PROGRESS_PATH}/littleGames/sweetheartDefenders`;
const timestamp = { kind: "server-timestamp" };
let documents: Map<string, FakeDoc>;
let transactionQueue: Promise<unknown>;

function snapshot(data: FakeDoc | undefined) {
  return {
    exists: () => data !== undefined,
    data: () => data,
  };
}

function cleared(cakes = 10) {
  return {
    phase: "cleared" as const,
    cakes,
    maxCakes: 10,
    kills: 5,
    waveIndex: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  documents = new Map([[PROGRESS_PATH, { coins: 20 }]]);
  transactionQueue = Promise.resolve();
  serviceMocks.getOrCreateProgress.mockResolvedValue({ coins: 20 });
  firestoreMocks.serverTimestamp.mockReturnValue(timestamp);
  firestoreMocks.doc.mockImplementation(
    (_db: unknown, ...segments: string[]): FakeRef => ({
      path: segments.join("/"),
      firestore: mockDb,
    }),
  );
  firestoreMocks.runTransaction.mockImplementation(
    (_db: unknown, callback: (transaction: unknown) => unknown) => {
      // Firestore 會讓同時碰同一文件的 transaction 重試；這個 queue 模擬重試後
      // callback 讀到上一筆已提交狀態，而呼叫端仍然是 Promise.all 並行送出。
      const committed = transactionQueue.then(() => {
        const transaction = {
          get: vi.fn(async (ref: FakeRef) => snapshot(documents.get(ref.path))),
          set: vi.fn((ref: FakeRef, data: FakeDoc) => {
            documents.set(ref.path, { ...data });
          }),
          update: vi.fn((ref: FakeRef, data: FakeDoc) => {
            documents.set(ref.path, {
              ...(documents.get(ref.path) ?? {}),
              ...data,
            });
          }),
        };
        return callback(transaction);
      });
      transactionQueue = committed.then(
        () => undefined,
        () => undefined,
      );
      return committed;
    },
  );
});

describe("transactional campaign sync", () => {
  it("unions stale device saves instead of overwriting a whole map", async () => {
    const first = LEVELS[0].id;
    const second = LEVELS[1].id;
    await saveCloud(UID, {
      ...createEmptySave(),
      levelStars: { [first]: 3 },
    });
    const committed = await saveCloud(UID, {
      ...createEmptySave(),
      levelStars: { [second]: 2 },
    });

    expect(committed.levelStars).toMatchObject({ [first]: 3, [second]: 2 });
    expect(documents.get(CAMPAIGN_PATH)?.levelStars).toMatchObject({
      [first]: 3,
      [second]: 2,
    });
  });

  it("awards one first-clear transaction when two tabs submit the same stale save", async () => {
    const level = LEVELS[0];
    const stale: SweetheartSaveV1 = createEmptySave();

    const [first, second] = await Promise.all([
      settleCloudRunResult(UID, stale, level.id, cleared(), level.coinReward),
      settleCloudRunResult(UID, stale, level.id, cleared(), level.coinReward),
    ]);

    expect(first.coinsEarned).toBe(
      level.coinReward.clear + level.coinReward.threeStars,
    );
    expect(second.coinsEarned).toBe(0);
    expect(documents.get(PROGRESS_PATH)?.coins).toBe(
      20 + first.coinsEarned,
    );
    expect(documents.get(CAMPAIGN_PATH)?.claimedClear).toEqual([level.id]);
    expect(documents.get(CAMPAIGN_PATH)?.claimedThreeStars).toEqual([level.id]);
  });

  it("atomically awards a guest save's pending stars once on sign-in", async () => {
    const level = LEVELS[0];
    const guest = {
      ...createEmptySave(),
      levelStars: { [level.id]: 3 as const },
    };

    const [first, second] = await Promise.all([
      syncCloudProgress(UID, guest),
      syncCloudProgress(UID, guest),
    ]);

    expect(first.coinsEarned + second.coinsEarned).toBe(
      level.coinReward.clear + level.coinReward.threeStars,
    );
    expect([first.coinsEarned, second.coinsEarned].sort((a, b) => a - b)).toEqual([
      0,
      level.coinReward.clear + level.coinReward.threeStars,
    ]);
    expect(documents.get(PROGRESS_PATH)?.coins).toBe(
      20 + level.coinReward.clear + level.coinReward.threeStars,
    );
    expect(documents.get(CAMPAIGN_PATH)?.claimedClear).toEqual([level.id]);
    expect(documents.get(CAMPAIGN_PATH)?.claimedThreeStars).toEqual([level.id]);
  });

  it("keeps both claims when stale tabs finish different levels", async () => {
    const [firstLevel, secondLevel] = LEVELS;
    const stale = createEmptySave();

    const [first, second] = await Promise.all([
      settleCloudRunResult(
        UID,
        stale,
        firstLevel.id,
        cleared(5),
        firstLevel.coinReward,
      ),
      settleCloudRunResult(
        UID,
        stale,
        secondLevel.id,
        cleared(5),
        secondLevel.coinReward,
      ),
    ]);

    expect(first.coinsEarned).toBe(firstLevel.coinReward.clear);
    expect(second.coinsEarned).toBe(secondLevel.coinReward.clear);
    expect(documents.get(CAMPAIGN_PATH)?.claimedClear).toEqual([
      firstLevel.id,
      secondLevel.id,
    ]);
    expect(documents.get(PROGRESS_PATH)?.coins).toBe(
      20 + first.coinsEarned + second.coinsEarned,
    );
  });
});
