import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { uid: string } | null,
}));
const cloudMocks = vi.hoisted(() => ({
  saveCloud: vi.fn(),
  settleCloudRunResult: vi.fn(),
  syncCloudProgress: vi.fn(),
}));
const gachaMocks = vi.hoisted(() => ({
  cached: {} as Record<string, Record<string, number>>,
  loadGachaCloud: vi.fn(),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    saveCloud: cloudMocks.saveCloud,
    settleCloudRunResult: cloudMocks.settleCloudRunResult,
    syncCloudProgress: cloudMocks.syncCloudProgress,
  };
});
vi.mock("../gacha-machine/gachaStorage", () => ({
  getGachaCacheKey: (uid: string) => `ollie-gacha-machine-cache-v1:${uid}`,
  readGachaCache: (uid: string) => {
    const ownedCounts = gachaMocks.cached[uid];
    return ownedCounts
      ? { schemaVersion: 1, resetVersion: 0, totalDraws: 0, ownedCounts }
      : null;
  },
  loadGachaCloud: gachaMocks.loadGachaCloud,
}));

import { LEVELS } from "./data/levels";
import { createEmptySave, readCache, writeCache } from "./storage";
import { useCampaignSave, type CampaignSave } from "./useCampaignSave";
import { useTowerRoster, type TowerRoster } from "./useTowerRoster";

let host: HTMLDivElement;
let root: Root;
let campaign: CampaignSave;
let roster: TowerRoster;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function Harness() {
  const nextCampaign = useCampaignSave();
  const nextRoster = useTowerRoster();
  useLayoutEffect(() => {
    campaign = nextCampaign;
    roster = nextRoster;
  }, [nextCampaign, nextRoster]);
  return null;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  authState.user = null;
  gachaMocks.cached = {};
  vi.clearAllMocks();
  cloudMocks.saveCloud.mockImplementation(
    async (_uid: string, save: ReturnType<typeof createEmptySave>) => save,
  );
  cloudMocks.syncCloudProgress.mockImplementation(
    async (_uid: string, save: ReturnType<typeof createEmptySave>) => ({
      save,
      coinsEarned: 0,
    }),
  );
  gachaMocks.loadGachaCloud.mockImplementation(async (uid: string) => ({
    schemaVersion: 1,
    resetVersion: 0,
    totalDraws: 0,
    ownedCounts: gachaMocks.cached[uid] ?? {},
  }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("account-scoped Sweetheart hooks", () => {
  it("keeps a guest reward pending until an account can receive the coins", async () => {
    const level = LEVELS[0];
    await render();

    let coins = -1;
    await act(async () => {
      const result = await campaign.recordResult(level.id, {
        phase: "cleared",
        cakes: 10,
        maxCakes: 10,
        kills: 5,
        waveIndex: 0,
      });
      coins = result.coinsEarned;
    });

    expect(coins).toBe(0);
    expect(campaign.save.levelStars[level.id]).toBe(3);
    expect(campaign.save.claimedClear).not.toContain(level.id);
    expect(campaign.save.claimedThreeStars).not.toContain(level.id);
  });

  it("retries a deferred settlement on reconnect and awards it once", async () => {
    const level = LEVELS[0];
    let awarded = false;
    let awardCount = 0;
    cloudMocks.syncCloudProgress.mockImplementation(
      async (_uid: string, save: ReturnType<typeof createEmptySave>) => {
        const hasPendingClear = (save.levelStars[level.id] ?? 0) > 0
          && !save.claimedClear.includes(level.id);
        if (!awarded && hasPendingClear) {
          awarded = true;
          awardCount += 1;
          return {
            save: {
              ...save,
              claimedClear: [level.id],
              claimedThreeStars: [level.id],
            },
            coinsEarned:
              level.coinReward.clear + level.coinReward.threeStars,
          };
        }
        return { save, coinsEarned: 0 };
      },
    );
    cloudMocks.settleCloudRunResult.mockRejectedValueOnce(
      new Error("offline"),
    );
    authState.user = { uid: "uid-a" };
    await render();

    let deferred = false;
    await act(async () => {
      const result = await campaign.recordResult(level.id, {
        phase: "cleared",
        cakes: 10,
        maxCakes: 10,
        kills: 5,
        waveIndex: 0,
      });
      deferred = result.deferred;
    });
    expect(deferred).toBe(true);
    expect(campaign.status).toBe("offline");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(campaign.status).toBe("saved");
    expect(campaign.save.claimedClear).toContain(level.id);
    expect(campaign.lastRecovery?.coinsEarned).toBe(
      level.coinReward.clear + level.coinReward.threeStars,
    );
    expect(awardCount).toBe(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(awardCount).toBe(1);
  });

  it("retries a transient sync failure without waiting for an online event", async () => {
    vi.useFakeTimers();
    try {
      cloudMocks.syncCloudProgress.mockRejectedValueOnce(
        new Error("transient firestore failure"),
      );
      authState.user = { uid: "uid-a" };
      await render();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(campaign.status).toBe("offline");
      expect(cloudMocks.syncCloudProgress).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
        await Promise.resolve();
      });

      expect(cloudMocks.syncCloudProgress).toHaveBeenCalledTimes(2);
      expect(campaign.status).toBe("saved");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not rerun when cloud progress only differs by key and claim order", async () => {
    const [levelA, levelB] = LEVELS;
    writeCache("uid-a", {
      ...createEmptySave(),
      levelStars: { [levelA.id]: 3, [levelB.id]: 2 },
      bestWave: { [levelA.id]: 4, [levelB.id]: 2 },
      claimedClear: [levelA.id, levelB.id],
      claimedThreeStars: [levelA.id, levelB.id],
      updatedAt: 10,
    });
    cloudMocks.syncCloudProgress.mockResolvedValue({
      save: {
        ...createEmptySave(),
        levelStars: { [levelB.id]: 2, [levelA.id]: 3 },
        bestWave: { [levelB.id]: 2, [levelA.id]: 4 },
        claimedClear: [levelB.id, levelA.id],
        claimedThreeStars: [levelB.id, levelA.id],
        updatedAt: 20,
      },
      coinsEarned: 0,
    });
    authState.user = { uid: "uid-a" };
    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(campaign.status).toBe("saved");
    expect(cloudMocks.syncCloudProgress).toHaveBeenCalledTimes(1);
  });

  it("queues focus and online sync behind a pending settlement", async () => {
    const level = LEVELS[0];
    const settlement = deferred<{
      save: ReturnType<typeof createEmptySave>;
      coinsEarned: number;
    }>();
    cloudMocks.syncCloudProgress.mockImplementation(
      async (uid: string, save: ReturnType<typeof createEmptySave>) => ({
        save: readCache(uid) ?? save,
        coinsEarned: 0,
      }),
    );
    cloudMocks.settleCloudRunResult.mockReturnValueOnce(settlement.promise);
    authState.user = { uid: "uid-a" };
    await render();

    let resultPromise!: ReturnType<CampaignSave["recordResult"]>;
    await act(async () => {
      resultPromise = campaign.recordResult(level.id, {
        phase: "cleared",
        cakes: 10,
        maxCakes: 10,
        kills: 5,
        waveIndex: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(cloudMocks.settleCloudRunResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
      await Promise.resolve();
    });
    // Only the mount sync has run. Both event retries are FIFO-blocked by the
    // settlement, so neither can claim this run's reward first.
    expect(cloudMocks.syncCloudProgress).toHaveBeenCalledTimes(1);

    const optimistic = readCache("uid-a") ?? createEmptySave();
    let result!: Awaited<ReturnType<CampaignSave["recordResult"]>>;
    await act(async () => {
      settlement.resolve({
        save: {
          ...optimistic,
          claimedClear: [level.id],
          claimedThreeStars: [level.id],
        },
        coinsEarned: level.coinReward.clear + level.coinReward.threeStars,
      });
      result = await resultPromise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.deferred).toBe(false);
    expect(result.coinsEarned).toBe(
      level.coinReward.clear + level.coinReward.threeStars,
    );
    expect(cloudMocks.syncCloudProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    const settlementCallOrder =
      cloudMocks.settleCloudRunResult.mock.invocationCallOrder[0];
    for (const callOrder of cloudMocks.syncCloudProgress.mock.invocationCallOrder.slice(1)) {
      expect(callOrder).toBeGreaterThan(settlementCallOrder);
    }
    expect(campaign.lastRecovery).toBeNull();
  });

  it("lets an initial sync finish before settlement, then recovers a deferred run", async () => {
    const level = LEVELS[0];
    const initialSync = deferred<{
      save: ReturnType<typeof createEmptySave>;
      coinsEarned: number;
    }>();
    cloudMocks.syncCloudProgress
      .mockImplementationOnce(() => initialSync.promise)
      .mockImplementation(
        async (_uid: string, save: ReturnType<typeof createEmptySave>) => ({
          save: {
            ...save,
            claimedClear: [level.id],
            claimedThreeStars: [level.id],
          },
          coinsEarned: level.coinReward.clear + level.coinReward.threeStars,
        }),
      );
    cloudMocks.settleCloudRunResult.mockRejectedValueOnce(new Error("offline"));
    authState.user = { uid: "uid-a" };
    await render();

    let resultPromise!: ReturnType<CampaignSave["recordResult"]>;
    await act(async () => {
      resultPromise = campaign.recordResult(level.id, {
        phase: "cleared",
        cakes: 10,
        maxCakes: 10,
        kills: 5,
        waveIndex: 0,
      });
      await Promise.resolve();
    });
    expect(cloudMocks.settleCloudRunResult).not.toHaveBeenCalled();

    let result!: Awaited<ReturnType<CampaignSave["recordResult"]>>;
    await act(async () => {
      initialSync.resolve({ save: createEmptySave(), coinsEarned: 0 });
      result = await resultPromise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.deferred).toBe(true);
    expect(result.recoveryRequestId).toBeTypeOf("number");
    expect(cloudMocks.syncCloudProgress.mock.invocationCallOrder[0]).toBeLessThan(
      cloudMocks.settleCloudRunResult.mock.invocationCallOrder[0],
    );
    expect(campaign.status).toBe("saved");
    expect(campaign.lastRecovery?.coinsEarned).toBe(
      level.coinReward.clear + level.coinReward.threeStars,
    );
    expect(campaign.lastRecovery?.requestIds).toContain(
      result.recoveryRequestId,
    );
  });

  it("drops campaign progress and paid roster immediately on logout", async () => {
    const level = LEVELS[0].id;
    writeCache("uid-a", {
      ...createEmptySave(),
      levelStars: { [level]: 3 },
    });
    gachaMocks.cached["uid-a"] = { "hello-kitty": 1 };
    authState.user = { uid: "uid-a" };
    await render();

    expect(campaign.save.levelStars[level]).toBe(3);
    expect(roster.availableIds).toContain("hello-kitty");

    authState.user = null;
    await render();

    expect(campaign.save.levelStars[level]).toBeUndefined();
    expect(campaign.isSignedIn).toBe(false);
    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.ownedCount).toBe(0);
  });

  it("loads B's local data on a direct A-to-B switch without merging A", async () => {
    const [levelA, levelB] = LEVELS;
    writeCache("uid-a", {
      ...createEmptySave(),
      levelStars: { [levelA.id]: 3 },
    });
    writeCache("uid-b", {
      ...createEmptySave(),
      levelStars: { [levelB.id]: 2 },
    });
    gachaMocks.cached["uid-a"] = { "hello-kitty": 1 };
    gachaMocks.cached["uid-b"] = { "my-melody": 1 };
    authState.user = { uid: "uid-a" };
    await render();

    authState.user = { uid: "uid-b" };
    await render();

    expect(campaign.save.levelStars[levelA.id]).toBeUndefined();
    expect(campaign.save.levelStars[levelB.id]).toBe(2);
    expect(campaign.status).toBe("saved");
    expect(readCache("uid-b")?.levelStars[levelA.id]).toBeUndefined();
    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.availableIds).toContain("my-melody");
  });

  it("does not let A's late roster response replace B after an account switch", async () => {
    gachaMocks.cached["uid-a"] = { "hello-kitty": 1 };
    gachaMocks.cached["uid-b"] = { "my-melody": 1 };
    let resolveA:
      | ((save: {
          schemaVersion: 1;
          resetVersion: number;
          totalDraws: number;
          ownedCounts: Record<string, number>;
        }) => void)
      | undefined;
    gachaMocks.loadGachaCloud.mockImplementation((uid: string) => {
      if (uid === "uid-a") {
        return new Promise<{
          schemaVersion: 1;
          resetVersion: number;
          totalDraws: number;
          ownedCounts: Record<string, number>;
        }>((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { "my-melody": 1 },
      });
    });
    authState.user = { uid: "uid-a" };
    await render();

    authState.user = { uid: "uid-b" };
    await render();
    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.availableIds).toContain("my-melody");

    await act(async () => {
      resolveA?.({
        schemaVersion: 1,
        resetVersion: 0,
        totalDraws: 1,
        ownedCounts: { "hello-kitty": 1 },
      });
      await Promise.resolve();
    });

    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.availableIds).toContain("my-melody");
  });

  it("migrates a guest save to only the first account that signs in", async () => {
    const level = LEVELS[0].id;
    writeCache(null, {
      ...createEmptySave(),
      levelStars: { [level]: 3 },
    });
    authState.user = { uid: "uid-a" };
    await render();

    expect(campaign.save.levelStars[level]).toBe(3);
    expect(readCache("uid-a")?.levelStars[level]).toBe(3);
    expect(readCache(null)).toBeNull();

    authState.user = { uid: "uid-b" };
    await render();

    expect(campaign.save.levelStars[level]).toBeUndefined();
    expect(readCache("uid-b")?.levelStars[level]).toBeUndefined();
  });

  it("keeps B's cache rather than A's roster when B's cloud read fails", async () => {
    gachaMocks.cached["uid-a"] = { "hello-kitty": 1 };
    gachaMocks.cached["uid-b"] = { "my-melody": 1 };
    gachaMocks.loadGachaCloud.mockRejectedValue(new Error("offline"));
    authState.user = { uid: "uid-a" };
    await render();

    authState.user = { uid: "uid-b" };
    await render();

    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.availableIds).toContain("my-melody");
  });
});
