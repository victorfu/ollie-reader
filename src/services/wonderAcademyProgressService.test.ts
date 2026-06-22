import { describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({ path: "wonder-academy-doc" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  db: { app: "firebase-app" },
}));

vi.mock("firebase/firestore", () => ({
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  setDoc: firestoreMocks.setDoc,
}));

vi.mock("../utils/firebaseUtil", () => ({
  db: firestoreMocks.db,
}));

import {
  WONDER_ACADEMY_CACHE_KEY,
  WONDER_ACADEMY_PENDING_KEY,
  createInitialWonderAcademyProgress,
  createWonderAcademyProgressService,
  parseWonderAcademyProgress,
  setFirestoreWonderAcademyProgress,
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
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

  it("writes cloud-saved progress to cache, calls cloud setter, and clears only user pending on successful save", async () => {
    const storage = memoryStorage();
    const progress = createInitialWonderAcademyProgress({
      userId: "user-1",
      now: "2026-06-22T10:00:00.000Z",
    });
    const otherPending = createInitialWonderAcademyProgress({ userId: "user-2" });
    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({
        "user-1": progress,
        "user-2": otherPending,
      }),
    );
    const setCloudProgress = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });
    const cloudSavedProgress = {
      ...progress,
      lastCloudSavedAt: "2026-06-22T10:00:00.000Z",
    };

    await expect(service.save(progress)).resolves.toEqual({
      cloudSaved: true,
      progress: cloudSavedProgress,
    });

    expect(setCloudProgress).toHaveBeenCalledWith(cloudSavedProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": cloudSavedProgress,
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-2": otherPending,
    });
  });

  it("preserves a newer pending save when an older overlapping cloud save succeeds", async () => {
    const storage = memoryStorage();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const newerPending = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const setCloudProgress = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });
    const cloudSavedProgress = {
      ...olderProgress,
      lastCloudSavedAt: olderProgress.updatedAt,
    };

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": newerPending }),
    );

    await expect(service.save(olderProgress)).resolves.toEqual({
      cloudSaved: true,
      progress: cloudSavedProgress,
    });

    expect(setCloudProgress).toHaveBeenCalledWith(cloudSavedProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": cloudSavedProgress,
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": newerPending,
    });
  });

  it("preserves equal-timestamp pending progress with different content when cloud save succeeds", async () => {
    const storage = memoryStorage();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const equalTimestampPending = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: olderProgress.updatedAt,
    });
    const setCloudProgress = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });
    const cloudSavedProgress = {
      ...olderProgress,
      lastCloudSavedAt: olderProgress.updatedAt,
    };

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": equalTimestampPending }),
    );

    await expect(service.save(olderProgress)).resolves.toEqual({
      cloudSaved: true,
      progress: cloudSavedProgress,
    });

    expect(setCloudProgress).toHaveBeenCalledWith(cloudSavedProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": equalTimestampPending,
    });
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

    await expect(service.save(progress)).resolves.toEqual({
      cloudSaved: false,
      progress,
    });

    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": progress,
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": progress,
    });
  });

  it("writes pending progress before an in-flight cloud save resolves", async () => {
    const storage = memoryStorage();
    const cloudWrite = deferred<void>();
    const progress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const olderCloudProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress: vi.fn<() => Promise<void>>().mockReturnValue(cloudWrite.promise),
    });

    const savePromise = service.save(progress);

    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": progress,
    });

    const reloadedService = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof olderCloudProgress>>().mockResolvedValue(
        olderCloudProgress,
      ),
      setCloudProgress: vi.fn(),
    });

    await expect(reloadedService.load("user-1")).resolves.toEqual(progress);

    cloudWrite.resolve();
    await expect(savePromise).resolves.toEqual({
      cloudSaved: true,
      progress: {
        ...progress,
        lastCloudSavedAt: progress.updatedAt,
      },
    });
  });

  it("preserves a newer pending save when an older overlapping cloud save fails", async () => {
    const storage = memoryStorage();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const newerPending = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress: vi.fn<() => Promise<void>>().mockRejectedValue(new Error("offline")),
    });

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": newerPending }),
    );

    await expect(service.save(olderProgress)).resolves.toEqual({
      cloudSaved: false,
      progress: olderProgress,
    });

    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": olderProgress,
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": newerPending,
    });
  });

  it("preserves equal-timestamp pending progress with different content when cloud save fails", async () => {
    const storage = memoryStorage();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const equalTimestampPending = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: olderProgress.updatedAt,
    });
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress: vi.fn<() => Promise<void>>().mockRejectedValue(new Error("offline")),
    });

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": equalTimestampPending }),
    );

    await expect(service.save(olderProgress)).resolves.toEqual({
      cloudSaved: false,
      progress: olderProgress,
    });

    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": equalTimestampPending,
    });
  });

  it("serializes cloud writes for the same user in save order", async () => {
    const storage = memoryStorage();
    const firstCloudWrite = deferred<void>();
    const secondCloudWrite = deferred<void>();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const newerProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const setCloudProgress = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstCloudWrite.promise)
      .mockReturnValueOnce(secondCloudWrite.promise);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });
    const olderCloudSavedProgress = {
      ...olderProgress,
      lastCloudSavedAt: olderProgress.updatedAt,
    };
    const newerCloudSavedProgress = {
      ...newerProgress,
      lastCloudSavedAt: newerProgress.updatedAt,
    };

    const olderSave = service.save(olderProgress);
    const newerSave = service.save(newerProgress);

    expect(setCloudProgress).toHaveBeenCalledTimes(1);
    expect(setCloudProgress).toHaveBeenNthCalledWith(1, olderCloudSavedProgress);

    firstCloudWrite.resolve();
    await expect(olderSave).resolves.toEqual({
      cloudSaved: true,
      progress: olderCloudSavedProgress,
    });

    expect(setCloudProgress).toHaveBeenCalledTimes(2);
    expect(setCloudProgress).toHaveBeenNthCalledWith(2, newerCloudSavedProgress);

    secondCloudWrite.resolve();
    await expect(newerSave).resolves.toEqual({
      cloudSaved: true,
      progress: newerCloudSavedProgress,
    });
  });

  it("continues queued cloud writes after an earlier save fails", async () => {
    const storage = memoryStorage();
    const firstCloudWrite = deferred<void>();
    const secondCloudWrite = deferred<void>();
    const olderProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const newerProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const setCloudProgress = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstCloudWrite.promise)
      .mockReturnValueOnce(secondCloudWrite.promise);
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn(),
      setCloudProgress,
    });
    const newerCloudSavedProgress = {
      ...newerProgress,
      lastCloudSavedAt: newerProgress.updatedAt,
    };

    const olderSave = service.save(olderProgress);
    const newerSave = service.save(newerProgress);

    expect(setCloudProgress).toHaveBeenCalledTimes(1);

    firstCloudWrite.reject(new Error("offline"));
    await expect(olderSave).resolves.toEqual({
      cloudSaved: false,
      progress: olderProgress,
    });

    expect(setCloudProgress).toHaveBeenCalledTimes(2);
    expect(setCloudProgress).toHaveBeenNthCalledWith(2, newerCloudSavedProgress);

    secondCloudWrite.resolve();
    await expect(newerSave).resolves.toEqual({
      cloudSaved: true,
      progress: newerCloudSavedProgress,
    });
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

  it("loads equal-timestamp pending progress over cloud progress when content differs", async () => {
    const storage = memoryStorage();
    const cloudProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const pendingProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: cloudProgress.updatedAt,
    });
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof cloudProgress>>().mockResolvedValue(cloudProgress),
      setCloudProgress: vi.fn(),
    });

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": pendingProgress }),
    );

    await expect(service.load("user-1")).resolves.toEqual(pendingProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-1": pendingProgress,
    });
  });

  it("loads equal-timestamp cloud progress and clears pending when logical content matches", async () => {
    const storage = memoryStorage();
    const pendingProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const cloudProgress = {
      ...pendingProgress,
      lastCloudSavedAt: pendingProgress.updatedAt,
    };
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof cloudProgress>>().mockResolvedValue(cloudProgress),
      setCloudProgress: vi.fn(),
    });

    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": pendingProgress }),
    );

    await expect(service.load("user-1")).resolves.toEqual(cloudProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toBeNull();
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": cloudProgress,
    });
  });

  it("loads pending progress when cloud loading fails", async () => {
    const storage = memoryStorage();
    const pendingProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({ "user-1": pendingProgress }),
    );
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<never>>().mockRejectedValue(new Error("offline")),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(pendingProgress);
  });

  it("loads cached progress when cloud loading fails and no pending save exists", async () => {
    const storage = memoryStorage();
    const cachedProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "nibi",
      now: "2026-06-22T10:00:00.000Z",
    });
    storage.setItem(
      WONDER_ACADEMY_CACHE_KEY,
      JSON.stringify({ "user-1": cachedProgress }),
    );
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<never>>().mockRejectedValue(new Error("offline")),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(cachedProgress);
  });

  it("loads cloud progress over cached progress", async () => {
    const storage = memoryStorage();
    const cachedProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const cloudProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "pico",
      now: "2026-06-22T10:05:00.000Z",
    });
    storage.setItem(WONDER_ACADEMY_CACHE_KEY, JSON.stringify(cachedProgress));
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof cloudProgress>>().mockResolvedValue(cloudProgress),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(cloudProgress);
  });

  it("loads user-specific progress from pending and cache maps", async () => {
    const storage = memoryStorage();
    const userOnePending = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:05:00.000Z",
    });
    const userTwoPending = createInitialWonderAcademyProgress({
      userId: "user-2",
      starterSpeciesId: "pico",
      now: "2026-06-22T10:10:00.000Z",
    });
    const userOneCache = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "lumi",
      now: "2026-06-22T10:00:00.000Z",
    });
    const userTwoCache = createInitialWonderAcademyProgress({
      userId: "user-2",
      starterSpeciesId: "nibi",
      now: "2026-06-22T10:00:00.000Z",
    });
    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({
        "user-1": userOnePending,
        "user-2": userTwoPending,
      }),
    );
    storage.setItem(
      WONDER_ACADEMY_CACHE_KEY,
      JSON.stringify({
        "user-1": userOneCache,
        "user-2": userTwoCache,
      }),
    );
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<null>>().mockResolvedValue(null),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(userOnePending);
    await expect(service.load("user-2")).resolves.toEqual(userTwoPending);
  });

  it("loads cached progress when cloud progress is absent", async () => {
    const storage = memoryStorage();
    const cachedProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "nibi",
      now: "2026-06-22T10:00:00.000Z",
    });
    storage.setItem(WONDER_ACADEMY_CACHE_KEY, JSON.stringify(cachedProgress));
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<null>>().mockResolvedValue(null),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(cachedProgress);
  });

  it("reconciles local state when newer cloud progress beats older pending progress", async () => {
    const storage = memoryStorage();
    const pendingProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "momo",
      now: "2026-06-22T10:00:00.000Z",
    });
    const otherPending = createInitialWonderAcademyProgress({
      userId: "user-2",
      starterSpeciesId: "nibi",
      now: "2026-06-22T10:02:00.000Z",
    });
    const cloudProgress = createInitialWonderAcademyProgress({
      userId: "user-1",
      starterSpeciesId: "pico",
      now: "2026-06-22T10:05:00.000Z",
    });
    storage.setItem(
      WONDER_ACADEMY_PENDING_KEY,
      JSON.stringify({
        "user-1": pendingProgress,
        "user-2": otherPending,
      }),
    );
    const service = createWonderAcademyProgressService({
      storage,
      getCloudProgress: vi.fn<() => Promise<typeof cloudProgress>>().mockResolvedValue(cloudProgress),
      setCloudProgress: vi.fn(),
    });

    await expect(service.load("user-1")).resolves.toEqual(cloudProgress);
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_CACHE_KEY) ?? "null")).toEqual({
      "user-1": cloudProgress,
    });
    expect(JSON.parse(storage.getItem(WONDER_ACADEMY_PENDING_KEY) ?? "null")).toEqual({
      "user-2": otherPending,
    });
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

  it("overwrites the Firestore progress document without merge semantics", async () => {
    const progress = createInitialWonderAcademyProgress({ userId: "user-1" });
    firestoreMocks.doc.mockClear();
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await setFirestoreWonderAcademyProgress(progress);

    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      firestoreMocks.db,
      "gameProgress",
      "user-1",
      "littleGames",
      "wonderAcademy",
    );
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: "wonder-academy-doc" },
      progress,
    );
  });
});
