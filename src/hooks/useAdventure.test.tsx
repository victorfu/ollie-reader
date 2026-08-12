import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameWord } from "../services/gameService";
import type { PlayerProgress } from "../types/game";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getOrCreateProgress: vi.fn(),
  fetchProgress: vi.fn(),
  saveProgressWithTokenReward: vi.fn(),
  claimDailyTokenBonus: vi.fn(),
  getDailyTokenBonusPreview: vi.fn(),
  prepareGamePool: vi.fn(),
  buildQuizQuestions: vi.fn(),
}));

const TEST_STAGES = vi.hoisted(() => [
  {
    id: "stage-a",
    name: "A",
    stageNumber: 1,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 50,
    questionCount: 5,
  },
  {
    id: "stage-b",
    name: "B",
    stageNumber: 2,
    isBoss: false,
    requiredLevel: 1,
    rewardExp: 60,
    questionCount: 1,
  },
]);

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/gameProgressService", () => ({
  getOrCreateProgress: mocks.getOrCreateProgress,
  fetchProgress: mocks.fetchProgress,
  saveProgressWithTokenReward: mocks.saveProgressWithTokenReward,
  claimDailyTokenBonus: mocks.claimDailyTokenBonus,
  getDailyTokenBonusPreview: mocks.getDailyTokenBonusPreview,
  isGameProgressResetConflictError: () => false,
  STAGES: TEST_STAGES,
  isStageCompleted: (stageIndex: number, currentStageIndex: number) =>
    stageIndex < currentStageIndex,
  isStagePlayable: (stageIndex: number, _level: number, current: number) =>
    stageIndex <= current,
}));
vi.mock("../services/gameService", () => ({
  prepareGamePool: mocks.prepareGamePool,
}));
vi.mock("../components/Game/quizQuestions", () => ({
  buildQuizQuestions: mocks.buildQuizQuestions,
  isQuestionCorrect: (
    question: { correctIndex: number },
    answer: number | string,
  ) => answer === question.correctIndex,
  resolveDefLanguage: (
    _pool: GameWord[],
    preferred: "zh" | "en",
  ) => preferred,
}));

import { useAdventure } from "./useAdventure";

type HookValue = ReturnType<typeof useAdventure>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const initialProgress: PlayerProgress = {
  odl: "player-1",
  level: 1,
  exp: 0,
  expToNextLevel: 100,
  currentStageIndex: 2,
  totalQuizCompleted: 0,
  totalBossDefeated: 0,
  highestCombo: 0,
  resetVersion: 0,
  coins: 0,
  streakDays: 0,
  lastLoginDate: "",
  lastDailyClaimDate: "",
  createdAt: 1,
  updatedAt: 1,
};

const gameWord = (word: string): GameWord => ({
  word,
  def: `${word}-definition`,
  emoji: "✨",
});

const progressFor = (
  uid: string,
  overrides: Partial<PlayerProgress> = {},
): PlayerProgress => ({
  ...initialProgress,
  odl: uid,
  ...overrides,
});

function settlementResult(
  overrides: Partial<PlayerProgress> = {},
) {
  const progress = { ...initialProgress, ...overrides };
  return {
    tokenBalance: progress.coins,
    progress: {
      level: progress.level,
      exp: progress.exp,
      expToNextLevel: progress.expToNextLevel,
      currentStageIndex: progress.currentStageIndex,
      totalQuizCompleted: progress.totalQuizCompleted,
      highestCombo: progress.highestCombo,
      totalBossDefeated: progress.totalBossDefeated,
      resetVersion: progress.resetVersion,
      coins: progress.coins,
    },
    didLevelUp: false,
    isNewHighScore: false,
  };
}

describe("useAdventure run ownership and settlement", () => {
  let root: Root;
  let host: HTMLDivElement;
  let current: HookValue;
  let authUid: string | null;

  function Probe() {
    const value = useAdventure();
    useEffect(() => {
      current = value;
    }, [value]);
    return null;
  }

  async function mount() {
    await act(async () => {
      root.render(<Probe />);
    });
    expect(current.progress).toEqual(initialProgress);
  }

  async function switchAccount(uid: string | null) {
    authUid = uid;
    await act(async () => {
      root.render(<Probe />);
    });
  }

  async function start(stageIndex: number, label: string) {
    mocks.prepareGamePool.mockResolvedValueOnce([gameWord(label)]);
    await act(async () => {
      await current.startQuiz(stageIndex, []);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    authUid = "player-1";
    mocks.useAuth.mockImplementation(() => ({
      user: authUid ? { uid: authUid } : null,
    }));
    mocks.getOrCreateProgress.mockResolvedValue(initialProgress);
    mocks.fetchProgress.mockResolvedValue(initialProgress);
    mocks.getDailyTokenBonusPreview.mockResolvedValue({
      claimDate: "2026-08-12",
      bonus: { eligible: false, coins: 0, streakDays: 0 },
    });
    mocks.buildQuizQuestions.mockImplementation(
      (pool: GameWord[], _stage: unknown, options: { count: number }) =>
        Array.from({ length: options.count }, (_, index) => ({
          kind: "meaning",
          word: `${pool[0].word}-${index}`,
          prompt: pool[0].word,
          options: ["correct", "wrong", "other", "extra"],
          correctIndex: 0,
        })),
    );
    mocks.saveProgressWithTokenReward.mockResolvedValue(settlementResult());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the newest stage when two async starts finish out of order", async () => {
    await mount();
    const first = deferred<GameWord[]>();
    const second = deferred<GameWord[]>();
    mocks.prepareGamePool
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    let firstStart!: Promise<void>;
    let secondStart!: Promise<void>;
    act(() => {
      firstStart = current.startQuiz(0, []);
      secondStart = current.startQuiz(1, []);
    });

    const firstSignal = mocks.prepareGamePool.mock.calls[0]?.[1] as AbortSignal;
    const secondSignal = mocks.prepareGamePool.mock.calls[1]?.[1] as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    await act(async () => {
      second.resolve([gameWord("new")]);
      await secondStart;
    });
    expect(current.currentStage?.id).toBe("stage-b");
    expect(current.quizState?.questions[0].word).toBe("new-0");

    await act(async () => {
      first.resolve([gameWord("old")]);
      await firstStart;
    });
    expect(current.currentStage?.id).toBe("stage-b");
    expect(current.quizState?.questions[0].word).toBe("new-0");
    expect(current.gameView).toBe("quiz");
  });

  it("keeps only the newest account load across an A-to-B-to-A switch", async () => {
    const oldA = deferred<PlayerProgress>();
    const oldB = deferred<PlayerProgress>();
    const newestA = progressFor("account-a", { exp: 73, coins: 19 });
    mocks.getOrCreateProgress
      .mockReturnValueOnce(oldA.promise)
      .mockReturnValueOnce(oldB.promise)
      .mockResolvedValueOnce(newestA);

    authUid = "account-a";
    await act(async () => {
      root.render(<Probe />);
    });
    expect(current.isLoading).toBe(true);
    expect(current.progress).toBeNull();

    await switchAccount("account-b");
    expect(current.isLoading).toBe(true);
    expect(current.progress).toBeNull();

    await switchAccount("account-a");
    expect(current.progress).toEqual(newestA);
    expect(current.isLoading).toBe(false);

    await act(async () => {
      oldA.resolve(progressFor("account-a", { exp: 999, coins: 999 }));
      oldB.resolve(progressFor("account-b", { exp: 555, coins: 555 }));
      await Promise.all([oldA.promise, oldB.promise]);
    });

    expect(mocks.getOrCreateProgress.mock.calls.map(([uid]) => uid)).toEqual([
      "account-a",
      "account-b",
      "account-a",
    ]);
    expect(current.progress).toEqual(newestA);
    expect(current.gameView).toBe("home");
  });

  it("cancels an old correct-answer timer when leaving and starting again", async () => {
    await mount();
    await start(0, "old");

    act(() => current.submitAnswer(0));
    act(() => current.quitQuiz());
    await start(0, "new");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(current.quizState?.questions[0].word).toBe("new-0");
    expect(current.quizState?.currentIndex).toBe(0);
    expect(current.quizState?.isAnswered).toBe(false);
  });

  it("ignores an old settlement result after a new run starts", async () => {
    await mount();
    const oldSettlement = deferred<ReturnType<typeof settlementResult>>();
    mocks.saveProgressWithTokenReward.mockReturnValueOnce(
      oldSettlement.promise,
    );
    await start(1, "old");

    act(() => current.submitAnswer(0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(current.isSettling).toBe(true);

    act(() => current.quitQuiz());
    await start(0, "new");
    await act(async () => {
      oldSettlement.resolve(
        settlementResult({
          exp: 60,
          currentStageIndex: 2,
          totalQuizCompleted: 1,
          coins: 25,
        }),
      );
      await oldSettlement.promise;
    });

    expect(current.gameView).toBe("quiz");
    expect(current.quizState?.questions[0].word).toBe("new-0");
    expect(current.progress?.exp).toBe(0);
    expect(current.pendingReward).toBeNull();
  });

  it("does not apply an account A settlement after switching to account B", async () => {
    await mount();
    const accountASettlement = deferred<ReturnType<typeof settlementResult>>();
    mocks.saveProgressWithTokenReward.mockReturnValueOnce(
      accountASettlement.promise,
    );
    await start(1, "account-a");

    act(() => current.submitAnswer(0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(current.isSettling).toBe(true);

    const accountBProgress = progressFor("account-b", {
      exp: 41,
      coins: 8,
      totalQuizCompleted: 4,
    });
    mocks.getOrCreateProgress.mockResolvedValueOnce(accountBProgress);
    await switchAccount("account-b");

    expect(current.progress).toEqual(accountBProgress);
    expect(current.gameView).toBe("home");
    expect(current.quizState).toBeNull();
    expect(current.isSettling).toBe(false);

    await act(async () => {
      accountASettlement.resolve(
        settlementResult({
          exp: 60,
          coins: 25,
          totalQuizCompleted: 1,
        }),
      );
      await accountASettlement.promise;
    });

    expect(mocks.saveProgressWithTokenReward.mock.calls[0][0]).toBe(
      "player-1",
    );
    expect(current.progress).toEqual(accountBProgress);
    expect(current.gameView).toBe("home");
    expect(current.quizState).toBeNull();
    expect(current.pendingReward).toBeNull();
    expect(current.tokenSyncError).toBeNull();
  });

  it("does not apply an account A daily bonus after switching to account B", async () => {
    const accountABonus = deferred<{
      tokenBalance: number;
      streakDays: number;
      claimDate: string;
    }>();
    mocks.getDailyTokenBonusPreview.mockResolvedValueOnce({
      claimDate: "2026-08-12",
      bonus: { eligible: true, coins: 10, streakDays: 1 },
    });
    mocks.claimDailyTokenBonus.mockReturnValueOnce(accountABonus.promise);
    await mount();

    let claimPromise!: Promise<void>;
    act(() => {
      claimPromise = current.claimDailyBonus();
    });
    expect(current.isClaimingDailyBonus).toBe(true);

    const accountBProgress = progressFor("account-b", {
      coins: 7,
      streakDays: 3,
    });
    mocks.getOrCreateProgress.mockResolvedValueOnce(accountBProgress);
    await switchAccount("account-b");

    await act(async () => {
      accountABonus.resolve({
        tokenBalance: 999,
        streakDays: 99,
        claimDate: "2026-08-12",
      });
      await claimPromise;
    });

    expect(mocks.claimDailyTokenBonus).toHaveBeenCalledWith("player-1");
    expect(current.progress).toEqual(accountBProgress);
    expect(current.isClaimingDailyBonus).toBe(false);
    expect(current.dailyBonusError).toBeNull();
  });

  it("keeps failed progress local state unchanged and retries exactly once", async () => {
    await mount();
    const retry = deferred<ReturnType<typeof settlementResult>>();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.saveProgressWithTokenReward
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(retry.promise);
    await start(1, "retry");

    act(() => current.submitAnswer(0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(current.progress?.exp).toBe(0);
    expect(current.progress?.totalQuizCompleted).toBe(0);
    expect(current.gameView).toBe("quiz");
    expect(current.canRetrySettlement).toBe(true);

    let firstRetry!: Promise<void>;
    let duplicateRetry!: Promise<void>;
    act(() => {
      firstRetry = current.retrySettlement();
      duplicateRetry = current.retrySettlement();
    });
    expect(mocks.saveProgressWithTokenReward).toHaveBeenCalledTimes(2);

    await act(async () => {
      retry.resolve(
        settlementResult({
          exp: 60,
          expToNextLevel: 40,
          totalQuizCompleted: 1,
          coins: 32,
        }),
      );
      await Promise.all([firstRetry, duplicateRetry]);
    });

    const firstRequest = mocks.saveProgressWithTokenReward.mock.calls[0][1];
    const retryRequest = mocks.saveProgressWithTokenReward.mock.calls[1][1];
    expect(retryRequest.settlementId).toBe(firstRequest.settlementId);
    expect(mocks.saveProgressWithTokenReward.mock.calls[1][2]).toBe(
      mocks.saveProgressWithTokenReward.mock.calls[0][2],
    );
    expect(current.progress?.exp).toBe(60);
    expect(current.progress?.totalQuizCompleted).toBe(1);
    expect(current.gameView).toBe("reward");
    expect(current.canRetrySettlement).toBe(false);
  });

  it("settles the peak combo instead of the final combo segment", async () => {
    await mount();
    mocks.saveProgressWithTokenReward.mockResolvedValue(
      settlementResult({ totalQuizCompleted: 1, highestCombo: 3 }),
    );
    await start(0, "combo");

    for (const answer of [0, 0, 0, 1, 0]) {
      act(() => current.submitAnswer(answer));
      if (answer === 0) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1_500);
        });
      } else {
        act(() => current.advanceQuestion());
      }
    }

    expect(mocks.saveProgressWithTokenReward).toHaveBeenCalledTimes(1);
    expect(mocks.saveProgressWithTokenReward.mock.calls[0][1]).toEqual(
      expect.objectContaining({ outcome: "victory", maxCombo: 3 }),
    );
  });
});
