import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultWonderAcademyAudioSettings } from "./wonderAcademyAudio";
import {
  checkpointWonderAcademyProgress,
  clearWonderAcademyPending,
  loadWonderAcademySave,
  normalizeWonderAcademySave,
  readWonderAcademyCache,
  readWonderAcademyPending,
  saveWonderAcademyProgress,
  syncWonderAcademyPendingSave,
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
    audioSettings: defaultWonderAcademyAudioSettings,
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

  it("preserves valid audio settings from saved progress", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        audioSettings: {
          musicVolume: 0.25,
          sfxVolume: 0.75,
          muted: true,
        },
      }),
    ).toMatchObject({
      audioSettings: {
        musicVolume: 0.25,
        sfxVolume: 0.75,
        muted: true,
      },
    });
  });

  it("defaults missing or malformed audio settings", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        audioSettings: {
          musicVolume: Number.NaN,
          sfxVolume: "loud",
          muted: "sometimes",
        },
      }),
    ).toMatchObject({
      audioSettings: defaultWonderAcademyAudioSettings,
    });

    expect(normalizeWonderAcademySave({ playerName: "Mina", team: [] })).toMatchObject({
      audioSettings: defaultWonderAcademyAudioSettings,
    });
  });

  it("backfills missing custom creature field skills from elements", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        customCreatures: [
          {
            speciesId: "custom-leaf",
            name: "Leaf Scout",
            category: "自訂夥伴",
            personality: "Legacy custom creature",
            elements: ["leaf"],
            rarity: "rare",
            favoriteSnack: "clover-macaron",
            growthStages: ["Leaf Scout"],
            moveIds: ["leaf-wink"],
            portrait: "leaf.png",
            wild: true,
          },
          {
            speciesId: "custom-empty",
            name: "Default Friend",
            category: "自訂夥伴",
            personality: "Legacy custom creature",
            elements: [],
            rarity: "rare",
            favoriteSnack: "starberry-cookie",
            growthStages: ["Default Friend"],
            moveIds: ["tiny-flash"],
            portrait: "default.png",
            wild: true,
          },
          {
            speciesId: "custom-existing",
            name: "Existing Skill",
            category: "自訂夥伴",
            personality: "Already migrated",
            elements: ["tide"],
            rarity: "rare",
            favoriteSnack: "moon-milk-puff",
            growthStages: ["Existing Skill"],
            moveIds: ["bubble-pat"],
            fieldSkillId: "soft-float",
            portrait: "existing.png",
            wild: true,
          },
        ],
      })?.customCreatures.map((creature) => [creature.speciesId, creature.fieldSkillId]),
    ).toEqual([
      ["custom-leaf", "secret-sense"],
      ["custom-empty", "light-trail"],
      ["custom-existing", "soft-float"],
    ]);
  });

  it("repairs invalid custom creature field skills from elements", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        customCreatures: [
          {
            speciesId: "custom-bad-skill",
            name: "Bad Skill",
            category: "自訂夥伴",
            personality: "Legacy custom creature with bad metadata",
            elements: ["tide"],
            rarity: "rare",
            favoriteSnack: "moon-milk-puff",
            growthStages: ["Bad Skill"],
            moveIds: ["bubble-pat"],
            fieldSkillId: "missing-skill",
            portrait: "bad.png",
            wild: true,
          },
        ],
      })?.customCreatures[0].fieldSkillId,
    ).toBe("soft-float");
  });

  it("backfills missing custom creature moves from elements", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      customCreatures: [
        {
          speciesId: "custom-no-moves",
          name: "No Moves",
          category: "自訂夥伴",
          personality: "Legacy custom creature without moves",
          elements: ["leaf"],
          rarity: "rare",
          favoriteSnack: "clover-macaron",
          growthStages: ["No Moves"],
          fieldSkillId: "secret-sense",
          portrait: "no-moves.png",
          wild: true,
        },
      ],
    });

    expect(normalized?.customCreatures[0].moveIds).toEqual([
      "leaf-wink",
      "clover-patch",
      "mossy-tackle",
      "spore-puff",
    ]);
  });

  it("repairs invalid custom creature moves from elements", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      customCreatures: [
        {
          speciesId: "custom-invalid-moves",
          name: "Invalid Moves",
          category: "自訂夥伴",
          personality: "Legacy custom creature with invalid moves",
          elements: ["tide"],
          rarity: "rare",
          favoriteSnack: "moon-milk-puff",
          growthStages: ["Invalid Moves"],
          moveIds: ["missing-move"],
          fieldSkillId: "soft-float",
          portrait: "invalid-moves.png",
          wild: true,
        },
      ],
    });

    expect(normalized?.customCreatures[0].moveIds).toEqual([
      "bubble-pat",
      "cozy-shield",
      "moon-drizzle",
    ]);
  });

  it("filters invalid custom creature elements before deriving metadata", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      customCreatures: [
        {
          speciesId: "custom-mixed-elements",
          name: "Mixed Elements",
          category: "自訂夥伴",
          personality: "Legacy custom creature with mixed metadata",
          elements: ["bogus", "leaf"],
          rarity: "rare",
          favoriteSnack: "clover-macaron",
          growthStages: ["Mixed Elements"],
          moveIds: ["missing-move"],
          fieldSkillId: "missing-skill",
          portrait: "mixed.png",
          wild: true,
        },
      ],
    });

    expect(normalized?.customCreatures[0]).toMatchObject({
      elements: ["leaf"],
      fieldSkillId: "secret-sense",
      moveIds: ["leaf-wink", "clover-patch", "mossy-tackle", "spore-puff"],
    });
  });

  it("defaults custom creature elements to light when none are valid", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      customCreatures: [
        {
          speciesId: "custom-bad-elements",
          name: "Bad Elements",
          category: "自訂夥伴",
          personality: "Legacy custom creature with bad elements",
          elements: ["bogus"],
          rarity: "rare",
          favoriteSnack: "starberry-cookie",
          growthStages: ["Bad Elements"],
          portrait: "bad-elements.png",
          wild: true,
        },
      ],
    });

    expect(normalized?.customCreatures[0]).toMatchObject({
      elements: ["light"],
      fieldSkillId: "light-trail",
      moveIds: ["tiny-flash", "starstep-dash", "aurora-parade"],
    });
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
      hasUnsyncedLocalProgress: false,
    });
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Cloud");
  });

  it("marks a newer local cache as unsynced when cloud is older", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyCache(uid, sample({ playerName: "Local" }), 300);
    vi.mocked(cloud.load).mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 200,
      data: sample({ playerName: "Cloud" }),
    });

    const loaded = await loadWonderAcademySave({ uid, cloud });

    expect(loaded).toEqual({
      data: sample({ playerName: "Local" }),
      source: "local",
      status: "pending",
      hasUnsyncedLocalProgress: true,
    });
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
      hasUnsyncedLocalProgress: true,
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

describe("checkpointWonderAcademyProgress", () => {
  it("writes local cache and queues a pending save by default", () => {
    const result = checkpointWonderAcademyProgress({
      uid,
      data: sample({ playerName: "Checkpoint" }),
      now: () => 700,
    });

    expect(result).toMatchObject({
      updatedAt: 700,
      data: sample({ playerName: "Checkpoint" }),
    });
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Checkpoint");
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 700,
      data: sample({ playerName: "Checkpoint" }),
    });
  });

  it("can skip pending queue writes for guest saves", () => {
    checkpointWonderAcademyProgress({
      uid,
      data: sample({ playerName: "Guest" }),
      queuePending: false,
      now: () => 800,
    });

    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("Guest");
    expect(readWonderAcademyPending(uid)).toBeNull();
  });
});

describe("syncWonderAcademyPendingSave", () => {
  it("flushes pending saves to cloud and clears the queue", async () => {
    const cloud = cloudAdapter();
    vi.mocked(cloud.save).mockResolvedValue(undefined);
    writeWonderAcademyPending(uid, sample({ playerName: "Queued" }), 900);

    const result = await syncWonderAcademyPendingSave({ uid, cloud });

    expect(result).toEqual({ status: "saved", updatedAt: 900 });
    expect(cloud.save).toHaveBeenCalledWith(uid, {
      schemaVersion: 2,
      updatedAt: 900,
      data: sample({ playerName: "Queued" }),
    });
    expect(readWonderAcademyPending(uid)).toBeNull();
  });

  it("keeps pending saves queued when cloud sync fails", async () => {
    const cloud = cloudAdapter();
    vi.mocked(cloud.save).mockRejectedValue(new Error("still offline"));
    writeWonderAcademyPending(uid, sample({ playerName: "Still queued" }), 1000);

    const result = await syncWonderAcademyPendingSave({ uid, cloud });

    expect(result).toEqual({ status: "pending", updatedAt: 1000 });
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 1000,
      data: sample({ playerName: "Still queued" }),
    });
  });
});
