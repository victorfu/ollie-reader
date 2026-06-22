import { describe, expect, it, vi } from "vitest";
import {
  WONDER_ACADEMY_CACHE_KEY,
  WONDER_ACADEMY_PENDING_KEY,
  createInitialWonderAcademyProgress,
  createWonderAcademyProgressService,
  parseWonderAcademyProgress,
} from "./wonderAcademyProgressService";

function memoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("Wonder Academy progress service", () => {
  it("creates a durable initial document with starter and safe defaults", () => {
    const progress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      starterNickname: "Lulu",
      now: "2026-06-22T10:00:00.000Z",
    });

    expect(progress).toMatchObject({
      schemaVersion: 1,
      userId: "user-1",
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
      lastCloudSavedAt: null,
      lastSafeResumePoint: "hub",
      starterSpeciesId: "lumi",
      starterNickname: "Lulu",
      storyProgress: {
        currentChapterId: "sparkleaf-grove",
        currentNodeId: "academy-gate",
        currentObjectiveId: "go-firefly-clearing",
      },
      audioSettings: {
        musicVolume: 0.45,
        sfxVolume: 0.65,
        muted: false,
      },
    });
    expect(progress.unlockedNodeIds).toContain("academy-gate");
    expect(progress.ownedWonderlings).toHaveLength(1);
    expect(progress.ownedWonderlings[0]).toMatchObject({
      speciesId: "lumi",
      nickname: "Lulu",
      level: 1,
      bond: 0,
      moodMax: 100,
      currentGrowthStage: 0,
    });
    expect(progress.wonderdex.lumi).toBe("attuned");
    expect(progress.keeperTeam.activeOwnedId).toBe(progress.ownedWonderlings[0].ownedId);
  });

  it("rejects malformed progress documents", () => {
    expect(parseWonderAcademyProgress(null)).toBeNull();
    expect(
      parseWonderAcademyProgress({
        ...createInitialWonderAcademyProgress({ userId: "user-1" }),
        schemaVersion: 2,
      }),
    ).toBeNull();
    expect(
      parseWonderAcademyProgress({
        ...createInitialWonderAcademyProgress({ userId: "user-1" }),
        userId: 22,
      }),
    ).toBeNull();
  });

  it("writes cache, calls cloud setter, and clears pending on successful save", async () => {
    const storage = memoryStorage();
    const progress = createInitialWonderAcademyProgress({
      userId: "user-1",
      now: "2026-06-22T10:00:00.000Z",
    });
    storage.setItem(WONDER_ACADEMY_PENDING_KEY, JSON.stringify(progress));
    const setCloudProgress = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });

    await expect(service.save(progress)).resolves.toEqual({ cloudSaved: true });

    expect(setCloudProgress).toHaveBeenCalledWith({
      ...progress,
      lastCloudSavedAt: "2026-06-22T10:00:00.000Z",
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual(progress);
    expect(storage.getItem(WONDER_ACADEMY_PENDING_KEY)).toBeNull();
  });

  it("stores pending progress when cloud save fails", async () => {
    const storage = memoryStorage();
    const progress = createInitialWonderAcademyProgress({
      userId: "user-1",
      now: "2026-06-22T10:00:00.000Z",
    });
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress: vi.fn<() => Promise<void>>().mockRejectedValue(new Error("offline")),
    });

    await expect(service.save(progress)).resolves.toEqual({ cloudSaved: false });

    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual(progress);
  });

  it("loads newer pending local progress over older cloud progress", async () => {
    const storage = memoryStorage();
    const cloudProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const pendingProgress = {
      ...createInitialWonderAcademyProgress({
        userId: "user-1",
        starterSpeciesId: "momo",
        now: "2026-06-22T10:05:00.000Z",
      }),
      updatedAt: "2026-06-22T10:05:00.000Z",
    };
    storage.setItem(WONDER_ACADEMY_PENDING_KEY, JSON.stringify(pendingProgress));
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof cloudProgress>>().mockResolvedValue(cloudProgress),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(pendingProgress);
  });

  it("ignores malformed local JSON while loading", async () => {
    const storage = memoryStorage();
    storage.setItem(WONDER_ACADEMY_PENDING_KEY, "{broken");
    storage.setItem(WONDER_ACADEMY_CACHE_KEY, "{also-broken");
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<null>>().mockResolvedValue(null),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toBeNull();
  });

  it("does not return cached, pending, or cloud progress for another user", async () => {
    const storage = memoryStorage();
    const otherPending = createInitialWonderAcademyProgress({ userId: "other-user" });
    const otherCache = createInitialWonderAcademyProgress({ userId: "other-user" });
    const otherCloud = createInitialWonderAcademyProgress({ userId: "other-user" });
    storage.setItem(WONDER_ACADEMY_PENDING_KEY, JSON.stringify(otherPending));
    storage.setItem(WONDER_ACADEMY_CACHE_KEY, JSON.stringify(otherCache));
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof otherCloud>>().mockResolvedValue(otherCloud),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toBeNull();
  });
});
