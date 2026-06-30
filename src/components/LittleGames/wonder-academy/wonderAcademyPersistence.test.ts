import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultWonderAcademyAudioSettings } from "./wonderAcademyAudio";
import {
  checkpointWonderAcademyProgress,
  clearWonderAcademyPending,
  loadWonderAcademySave,
  localOnlyWonderAcademyCloudAdapter,
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

  it("normalizes malformed owned team creatures", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [
        {
          ownedId: "owned-lumi",
          speciesId: "lumi",
          nickname: 42,
          level: "high",
          xp: -20,
          bond: 500,
          stage: -2,
          equippedMoveIds: ["zip-spark", "missing-move", 7],
          shiny: true,
        },
        { ownedId: "bad-species", speciesId: 42 },
        null,
      ],
    });

    expect(normalized?.team).toEqual([
      {
        ownedId: "owned-lumi",
        speciesId: "lumi",
        nickname: "",
        level: 1,
        xp: 0,
        bond: 100,
        stage: 0,
        equippedMoveIds: ["zip-spark"],
        shiny: true,
      },
    ]);
  });

  it("normalizes malformed Wonderdex records", () => {
    const normalized = normalizeWonderAcademySave({
      playerName: "Mina",
      team: [],
      dex: {
        lumi: "caught",
        "  momo  ": "evolved",
        pico: "mystery",
        nibi: 3,
        "": "seen",
        sparkleaf: "unseen",
      },
    });

    expect(normalized?.dex).toEqual({
      lumi: "caught",
      momo: "evolved",
      sparkleaf: "unseen",
    });
  });

  it("normalizes economy values to non-negative integers", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        stardust: -12.8,
        snacks: {
          "starberry-cookie": -2,
          "moon-milk-puff": 3.8,
          "warm-cocoa-gem": Number.NaN,
        },
      }),
    ).toMatchObject({
      stardust: 0,
      snacks: {
        "starberry-cookie": 0,
        "moon-milk-puff": 3,
      },
    });
  });

  it("normalizes progress arrays to unique safe ids and milestones", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        wardensDefeated: ["sparkleaf-grove", " ", "sparkleaf-grove", 7],
        clearedNodes: [
          "sparkleaf-grove:meadow-path",
          "sparkleaf-grove:meadow-path",
          "",
        ],
        shinyDex: ["lumi", "lumi", "  momo  ", null],
        dexRewardsClaimed: [3, 3, -1, 5.9, Number.NaN, "8"],
      }),
    ).toMatchObject({
      wardensDefeated: ["sparkleaf-grove"],
      clearedNodes: ["sparkleaf-grove:meadow-path"],
      shinyDex: ["lumi", "momo"],
      dexRewardsClaimed: [3, 5],
    });
  });

  it("normalizes malformed daily progress", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        daily: {
          date: "2026-6-30",
          counts: {
            catch: 1.8,
            win: -2,
            chest: "many",
            extra: 99,
          },
          claimed: ["catch", "catch", "bogus", 7, "win"],
        },
      }),
    ).toMatchObject({
      daily: {
        date: "2026-6-30",
        counts: { catch: 1, win: 0, chest: 0 },
        claimed: ["catch", "win"],
      },
    });
  });

  it("normalizes saved daily reward dates", () => {
    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        lastDailyReward: " 2026-6-30 ",
      })?.lastDailyReward,
    ).toBe("2026-6-30");

    expect(
      normalizeWonderAcademySave({
        playerName: "Mina",
        team: [],
        lastDailyReward: " ",
      })?.lastDailyReward,
    ).toBeNull();
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
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 300,
      data: sample({ playerName: "Local" }),
    });
  });

  it("queues local cache as pending when cloud has no save", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyCache(uid, sample({ playerName: "Local only" }), 300);
    vi.mocked(cloud.load).mockResolvedValue(null);

    const loaded = await loadWonderAcademySave({ uid, cloud });

    expect(loaded).toMatchObject({
      source: "local",
      status: "pending",
      hasUnsyncedLocalProgress: true,
    });
    expect(readWonderAcademyPending(uid)).toMatchObject({
      updatedAt: 300,
      data: sample({ playerName: "Local only" }),
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

  it("clears stale pending data when cloud is newer during load", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyPending(uid, sample({ playerName: "Old pending" }), 300);
    vi.mocked(cloud.load).mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 400,
      data: sample({ playerName: "New cloud" }),
    });

    const loaded = await loadWonderAcademySave({ uid, cloud });

    expect(loaded).toEqual({
      data: sample({ playerName: "New cloud" }),
      source: "cloud",
      status: "saved",
      hasUnsyncedLocalProgress: false,
    });
    expect(readWonderAcademyPending(uid)).toBeNull();
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

  it("saves guest progress locally without leaving pending sync work", async () => {
    const result = await saveWonderAcademyProgress({
      uid: "guest",
      data: sample({ playerName: "Guest local" }),
      cloud: localOnlyWonderAcademyCloudAdapter,
      now: () => 600,
    });

    expect(result).toEqual({ status: "saved", updatedAt: 600 });
    expect(readWonderAcademyCache("guest")?.data.playerName).toBe("Guest local");
    expect(readWonderAcademyPending("guest")).toBeNull();
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

  it("does not overwrite newer cloud saves with stale pending data", async () => {
    const cloud = cloudAdapter();
    writeWonderAcademyPending(uid, sample({ playerName: "Old pending" }), 900);
    vi.mocked(cloud.load).mockResolvedValue({
      schemaVersion: 2,
      updatedAt: 1000,
      data: sample({ playerName: "New cloud" }),
    });

    const result = await syncWonderAcademyPendingSave({ uid, cloud });

    expect(result).toEqual({ status: "saved", updatedAt: 1000 });
    expect(cloud.save).not.toHaveBeenCalled();
    expect(readWonderAcademyCache(uid)?.data.playerName).toBe("New cloud");
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
