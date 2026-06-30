import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWonderAcademyPending,
  loadWonderAcademySave,
  normalizeWonderAcademySave,
  readWonderAcademyCache,
  readWonderAcademyPending,
  saveWonderAcademyProgress,
  writeWonderAcademyCache,
  writeWonderAcademyPending,
  type WonderAcademyCloudAdapter,
  type WonderAcademyProgressData,
} from "./wonderAcademyPersistence";

const uid = "player-1";

function sample(overrides: Partial<WonderAcademyProgressData> = {}): WonderAcademyProgressData {
  return {
    playerName: "Mina",
    team: [],
    dex: {},
    stardust: 0,
    snacks: {},
    customCreatures: [],
    wardensDefeated: [],
    clearedNodes: [],
    shinyDex: [],
    dexRewardsClaimed: [],
    lastDailyReward: null,
    daily: null,
    ...overrides,
  };
}

function cloudAdapter(): WonderAcademyCloudAdapter {
  return {
    load: vi.fn(),
    save: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("normalizeWonderAcademySave", () => {
  it("rejects malformed saves without a team array", () => {
    expect(normalizeWonderAcademySave(null)).toBeNull();
    expect(normalizeWonderAcademySave({ playerName: "bad" })).toBeNull();
  });

  it("fills missing optional collections with safe defaults", () => {
    expect(normalizeWonderAcademySave({ playerName: "Mina", team: [] })).toEqual(
      sample({ playerName: "Mina" }),
    );
  });
});

describe("local cache and pending queue", () => {
  it("reads the legacy v2 local save shape", () => {
    localStorage.setItem(
      "wonder-academy-game-v2-player-1",
      JSON.stringify(sample({ playerName: "Legacy" })),
    );

    const cached = readWonderAcademyCache(uid);

    expect(cached).toMatchObject({
      source: "legacy-local",
      updatedAt: 0,
      data: sample({ playerName: "Legacy" }),
    });
  });

  it("writes and clears a pending save", () => {
    writeWonderAcademyPending(uid, sample({ playerName: "Pending" }), 300);
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 300,
      data: sample({ playerName: "Pending" }),
    });

    clearWonderAcademyPending(uid);
    expect(readWonderAcademyPending(uid)).toBeNull();
  });
});

describe("loadWonderAcademySave", () => {
  it("prefers a newer cloud save over local cache and refreshes the cache", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyCache(uid, sample({ playerName: "Local" }), 100);
    vi.mocked(cloud.load).mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 200,
      data: sample({ playerName: "Cloud" }),
    });

    const loaded = await loadWonderAcademySave({ uid, cloud });

    expect(loaded).toEqual({
      data: sample({ playerName: "Cloud" }),
      source: "cloud",
      status: "saved",
    });
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Cloud");
  });

  it("keeps a pending save when it is newer than cloud", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyCache(uid, sample({ playerName: "Local" }), 100);
    writeWonderAcademyPending(uid, sample({ playerName: "Pending" }), 300);
    vi.mocked(cloud.load).mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 200,
      data: sample({ playerName: "Cloud" }),
    });

    const loaded = await loadWonderAcademySave({ uid, cloud });

    expect(loaded).toEqual({
      data: sample({ playerName: "Pending" }),
      source: "pending",
      status: "pending",
    });
  });
});

describe("saveWonderAcademyProgress", () => {
  it("writes local cache, saves cloud, and clears stale pending saves", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyPending(uid, sample({ playerName: "Old pending" }), 50);
    vi.mocked(cloud.save).mockResolvedValue(undefined);

    const result = await saveWonderAcademyProgress({
      uid,
      data: sample({ playerName: "Fresh" }),
      cloud,
      now: () => 400,
    });

    expect(result).toEqual({ status: "saved", updatedAt: 400 });
    expect(cloud.save).toHaveBeenCalledWith(uid, {
      schemaVersion: 2,
      updatedAt: 400,
      data: sample({ playerName: "Fresh" }),
    });
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Fresh");
    expect(readWonderAcademyPending(uid)).toBeNull();
  });

  it("queues a pending save when cloud save fails", async () => {
    const cloud = cloudAdapter();
    vi.mocked(cloud.save).mockRejectedValue(new Error("offline"));

    const result = await saveWonderAcademyProgress({
      uid,
      data: sample({ playerName: "Offline" }),
      cloud,
      now: () => 500,
    });

    expect(result).toEqual({ status: "pending", updatedAt: 500 });
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Offline");
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 500,
      data: sample({ playerName: "Offline" }),
    });
  });
});
