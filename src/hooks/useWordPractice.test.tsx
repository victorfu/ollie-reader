import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Homework,
  HomeworkProgress,
  PracticeSettings,
  WordPracticeState,
} from "../types/wordPractice";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  loadPracticeState: vi.fn(),
  saveSettings: vi.fn(),
  getActiveHomework: vi.fn(),
  listCompletedHomeworks: vi.fn(),
  saveHomeworkProgress: vi.fn(),
  abandonHomework: vi.fn(),
  resetPracticeProgress: vi.fn(),
  completeHomework: vi.fn(),
  generateHomework: vi.fn(),
  updateReviewStats: vi.fn(),
  saveHomeworkReview: vi.fn(),
  reviewSentences: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/wordPracticeStorage", () => ({
  loadPracticeState: mocks.loadPracticeState,
  saveSettings: mocks.saveSettings,
  getActiveHomework: mocks.getActiveHomework,
  listCompletedHomeworks: mocks.listCompletedHomeworks,
  saveHomeworkProgress: mocks.saveHomeworkProgress,
  abandonHomework: mocks.abandonHomework,
  resetPracticeProgress: mocks.resetPracticeProgress,
  completeHomework: mocks.completeHomework,
  saveHomeworkReview: mocks.saveHomeworkReview,
}));
vi.mock("../services/sentenceReview", () => ({ reviewSentences: mocks.reviewSentences }));
vi.mock("../services/wordPracticeService", () => ({
  generateHomework: mocks.generateHomework,
}));
vi.mock("../services/vocabularyService", () => ({
  updateReviewStats: mocks.updateReviewStats,
}));
vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mocks.loggerError,
  },
}));

import { useWordPractice, type UseWordPractice } from "./useWordPractice";

const SETTINGS: PracticeSettings = { newWordCount: 2, reviewLimit: 10, startLevel: "A1" };

type CompleteResult = {
  homework: Homework;
  reviewUpdates: { vocabularyId: string; remembered: boolean }[];
};

function practiceState(dueCount = 0, settings: PracticeSettings = SETTINGS): WordPracticeState {
  const words: WordPracticeState["words"] = {};
  for (let index = 0; index < dueCount; index += 1) {
    words[`due-${index}`] = { stage: 1, dueAt: 1, missCount: 0 };
  }
  return {
    schemaVersion: 2,
    activeHomeworkId: null,
    words,
    cefrEstimates: {},
    settings,
  };
}

function blankProgress(count: number): HomeworkProgress {
  return {
    pages: Array.from({ length: count }, () => ({
      section: "look" as const,
      copies: 0,
      phrase: null,
      sentence: null,
    })),
    dictation: [],
    corrections: {},
  };
}

function homework(id: string, overrides: Partial<Homework> = {}): Homework {
  const newWords = ["apple", "river"].map((word) => ({
    key: word,
    vocabularyId: `vocab-${word}`,
    word,
    definitions: [{ partOfSpeech: "noun", definition: `a ${word}` }],
    sentence: null,
    cefr: null,
  }));
  return {
    version: 2,
    id,
    status: "active",
    createdAt: 1_000,
    newWords,
    reviewWords: [],
    ...blankProgress(newWords.length),
    ...overrides,
  };
}

/** Progress where the first pages have been copied, so it differs from `blankProgress`. */
function progressWithCopies(count: number, copiedCount: number): HomeworkProgress {
  const blank = blankProgress(count);
  return {
    ...blank,
    pages: blank.pages.map((page, index) => ({
      ...page,
      copies: index < copiedCount ? 3 : 0,
    })),
  };
}

function completedHomework(id: string): Homework {
  return homework(id, {
    status: "completed",
    completedAt: 2_000,
    result: {
      correctKeys: ["apple"],
      wrongKeys: ["river"],
      skippedKeys: [],
      correctCount: 1,
      total: 2,
    },
  });
}

function completion(id: string, reviewUpdates: CompleteResult["reviewUpdates"] = []): CompleteResult {
  return { homework: completedHomework(id), reviewUpdates };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

let root: Root | null;
let host: HTMLDivElement | null;
let currentHook: UseWordPractice | null;

function Probe() {
  const wordPractice = useWordPractice();
  useEffect(() => {
    currentHook = wordPractice;
  });
  return null;
}

function hook(): UseWordPractice {
  if (!currentHook) throw new Error("Word practice hook did not render");
  return currentHook;
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderProbe() {
  root = createRoot(host as HTMLDivElement);
  await act(async () => {
    root?.render(<Probe />);
  });
  await flushAsyncWork();
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  currentHook = null;

  mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
  mocks.loadPracticeState.mockResolvedValue(practiceState());
  mocks.saveSettings.mockResolvedValue(undefined);
  mocks.updateReviewStats.mockResolvedValue(undefined);
  mocks.getActiveHomework.mockResolvedValue(homework("hw-1"));
  mocks.listCompletedHomeworks.mockResolvedValue([completedHomework("old-1")]);
  mocks.saveHomeworkProgress.mockResolvedValue(undefined);
  mocks.abandonHomework.mockResolvedValue(undefined);
  mocks.resetPracticeProgress.mockResolvedValue(undefined);
  mocks.completeHomework.mockImplementation(async (_uid: string, id: string) =>
    completion(id),
  );
  mocks.saveHomeworkReview.mockResolvedValue(undefined);
  mocks.reviewSentences.mockResolvedValue([]);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("useWordPractice loading", () => {
  it("reads state, the active homework and the history, then becomes ready", async () => {
    const reading = deferred<Homework | null>();
    mocks.getActiveHomework.mockReturnValueOnce(reading.promise);
    root = createRoot(host as HTMLDivElement);
    await act(async () => {
      root?.render(<Probe />);
    });

    expect(hook().status).toBe("loading");
    expect(hook().active).toBeNull();

    await act(async () => {
      reading.resolve(homework("hw-1"));
    });
    await flushAsyncWork();

    expect(mocks.loadPracticeState).toHaveBeenCalledWith("user-1", expect.any(Number));
    expect(mocks.getActiveHomework).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ settings: SETTINGS }),
    );
    // The state document is read once per load and handed on to getActiveHomework.
    expect(mocks.loadPracticeState).toHaveBeenCalledTimes(1);
    expect(mocks.listCompletedHomeworks).toHaveBeenCalledWith("user-1");
    expect(hook().status).toBe("ready");
    expect(hook().error).toBeNull();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().history.map((item) => item.id)).toEqual(["old-1"]);
    expect(hook().settings).toEqual(SETTINGS);
  });

  it("stays loading and calls nothing without a signed-in user", async () => {
    mocks.useAuth.mockReturnValue({ user: null });

    await renderProbe();

    expect(hook().status).toBe("loading");
    expect(mocks.loadPracticeState).not.toHaveBeenCalled();
    expect(mocks.getActiveHomework).not.toHaveBeenCalled();
    expect(mocks.listCompletedHomeworks).not.toHaveBeenCalled();
  });

  it("reports a Chinese error when loading fails and recovers on reload", async () => {
    mocks.getActiveHomework.mockRejectedValueOnce(new Error("offline"));

    await renderProbe();

    expect(hook().status).toBe("error");
    expect(hook().error).toMatch(/[一-鿿]/);
    expect(hook().active).toBeNull();

    await act(async () => {
      await hook().reload();
    });

    expect(hook().status).toBe("ready");
    expect(hook().error).toBeNull();
    expect(hook().active?.id).toBe("hw-1");
  });

  it("reload re-reads the active homework and the history", async () => {
    await renderProbe();
    mocks.getActiveHomework.mockResolvedValueOnce(null);
    mocks.listCompletedHomeworks.mockResolvedValueOnce([
      completedHomework("old-2"),
      completedHomework("old-1"),
    ]);

    await act(async () => {
      await hook().reload();
    });

    expect(hook().active).toBeNull();
    expect(hook().history.map((item) => item.id)).toEqual(["old-2", "old-1"]);
  });

  it("shows the due review count capped by the review limit", async () => {
    mocks.loadPracticeState.mockResolvedValue(practiceState(12));

    await renderProbe();

    expect(hook().reviewDueCount).toBe(10);
  });

  it("shows the real due count when it is under the review limit", async () => {
    mocks.loadPracticeState.mockResolvedValue(practiceState(3));

    await renderProbe();

    expect(hook().reviewDueCount).toBe(3);
  });
});

describe("useWordPractice reload and account changes", () => {
  it("lets an in-flight progress save finish before re-reading", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    mocks.getActiveHomework.mockClear();

    let reloading!: Promise<void>;
    act(() => {
      reloading = hook().reload();
    });
    await flushAsyncWork();
    expect(mocks.getActiveHomework).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve();
      await reloading;
    });

    expect(mocks.getActiveHomework).toHaveBeenCalledTimes(1);
    expect(hook().status).toBe("ready");
  });

  it("drops the previous account's data and ignores its late response", async () => {
    const lateRead = deferred<Homework | null>();
    mocks.getActiveHomework.mockReturnValueOnce(lateRead.promise);
    await renderProbe();
    expect(hook().status).toBe("loading");

    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    mocks.getActiveHomework.mockResolvedValueOnce(homework("hw-user-2"));
    await act(async () => {
      root?.render(<Probe />);
    });
    await flushAsyncWork();
    expect(mocks.getActiveHomework).toHaveBeenLastCalledWith("user-2", expect.anything());
    expect(hook().active?.id).toBe("hw-user-2");

    await act(async () => {
      lateRead.resolve(homework("hw-user-1"));
      await lateRead.promise;
    });
    await flushAsyncWork();

    expect(hook().active?.id).toBe("hw-user-2");
    expect(hook().status).toBe("ready");
  });
});

describe("useWordPractice progress saving", () => {
  it("updates the progress at once and saves it", async () => {
    await renderProbe();
    const next = progressWithCopies(2, 1);

    act(() => hook().updateProgress(next));

    expect(hook().active?.pages).toBe(next.pages);
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledWith("user-1", "hw-1", next);
    expect(hook().saveError).toBeNull();
  });

  it("reports a failed save, then resends the full latest progress and clears the error", async () => {
    await renderProbe();
    const first = progressWithCopies(2, 1);
    const second = progressWithCopies(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValueOnce(new Error("offline"));

    act(() => hook().updateProgress(first));
    await flushAsyncWork();

    expect(hook().saveError).toMatch(/[一-鿿]/);
    expect(hook().active?.pages).toBe(first.pages);

    act(() => hook().updateProgress(second));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", second);
    expect(hook().saveError).toBeNull();
  });

  it("never overlaps saves and always ends with the latest progress", async () => {
    await renderProbe();
    const firstSave = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(firstSave.promise);
    const first = progressWithCopies(2, 1);
    const second = progressWithCopies(2, 2);
    const third: HomeworkProgress = { ...blankProgress(2), corrections: { apple: 3 } };

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(second));
    act(() => hook().updateProgress(third));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", first);
    expect(hook().active?.corrections).toBe(third.corrections);

    await act(async () => {
      firstSave.resolve();
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", third);
    expect(hook().saveError).toBeNull();
  });
});

describe("useWordPractice saves across unmount", () => {
  it("still saves the latest answers that were queued behind a save when the page unmounts", async () => {
    await renderProbe();
    const firstSave = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(firstSave.promise);
    const first = progressWithCopies(2, 1);
    const second = progressWithCopies(2, 2);

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(second));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = null;
    firstSave.resolve();
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", second);
  });

  it("saves a previous account's queued answers for that account after an account switch", async () => {
    await renderProbe();
    const firstSave = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(firstSave.promise);
    const first = progressWithCopies(2, 1);
    const second = progressWithCopies(2, 2);

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(second));

    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    mocks.getActiveHomework.mockResolvedValueOnce(null);
    await act(async () => {
      root?.render(<Probe />);
    });
    await act(async () => {
      firstSave.resolve();
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", second);
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(hook().saveError).toBeNull();
    expect(hook().active).toBeNull();
  });
});

describe("useWordPractice homework streak", () => {
  it("says a homework today would be the first of the day and continue yesterday's streak", async () => {
    const now = new Date(2026, 9, 25, 18).getTime();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    mocks.loadPracticeState.mockResolvedValue({
      ...practiceState(),
      homeworkStreak: { lastDay: "2026-10-24", days: 2 },
    });
    await renderProbe();
    clock.mockRestore();
    expect(hook().homeworkStreak).toEqual({ firstToday: true, days: 3 });
  });

  it("says today's daily bonus is used once a homework was handed in today", async () => {
    const now = new Date(2026, 9, 25, 18).getTime();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    mocks.loadPracticeState.mockResolvedValue({
      ...practiceState(),
      homeworkStreak: { lastDay: "2026-10-25", days: 4 },
    });
    await renderProbe();
    clock.mockRestore();
    expect(hook().homeworkStreak).toEqual({ firstToday: false, days: 4 });
  });
});

describe("useWordPractice sentence review", () => {
  const REVIEWS = [{ key: "apple", ok: false, comment: "要加 an。", corrected: "I ate an apple." }];
  const withSentence = (id: string) => {
    const done = completedHomework(id);
    return {
      ...done,
      pages: done.pages.map((page, i) => ({ ...page, sentence: i === 0 ? "I ate a apple." : null })),
    };
  };

  it("reviews the sentences once after submitting and stores the review in the history", async () => {
    mocks.completeHomework.mockResolvedValue({ homework: withSentence("hw-1"), reviewUpdates: [] });
    mocks.reviewSentences.mockResolvedValue(REVIEWS);
    await renderProbe();

    await act(() => hook().submit());
    await flushAsyncWork();

    expect(mocks.reviewSentences).toHaveBeenCalledTimes(1);
    expect(mocks.reviewSentences.mock.calls[0][0]).toEqual([
      { key: "apple", word: "apple", sentence: "I ate a apple." },
    ]);
    expect(mocks.saveHomeworkReview).toHaveBeenCalledWith(
      "user-1",
      "hw-1",
      expect.objectContaining({ items: REVIEWS }),
    );
    expect(hook().history[0]).toMatchObject({ id: "hw-1", review: { items: REVIEWS } });
    expect(hook().reviewState["hw-1"]).toBeUndefined();
  });

  it("does not ask Gemini when no sentence was written", async () => {
    await renderProbe();
    await act(() => hook().submit());
    await flushAsyncWork();
    expect(mocks.reviewSentences).not.toHaveBeenCalled();
  });

  it("marks a failed review so it can be retried, without failing the homework", async () => {
    mocks.completeHomework.mockResolvedValue({ homework: withSentence("hw-1"), reviewUpdates: [] });
    mocks.reviewSentences.mockRejectedValueOnce(new Error("quota"));
    await renderProbe();

    await act(() => hook().submit());
    await flushAsyncWork();
    expect(hook().reviewState["hw-1"]).toBe("failed");
    expect(hook().error).toBeNull();
    expect(hook().history[0]).toMatchObject({ id: "hw-1", status: "completed" });

    mocks.reviewSentences.mockResolvedValueOnce(REVIEWS);
    await act(() => hook().reviewHomework(hook().history[0] as Homework));
    expect(mocks.reviewSentences).toHaveBeenCalledTimes(2);
    expect(hook().history[0]).toMatchObject({ review: { items: REVIEWS } });
    expect(hook().reviewState["hw-1"]).toBeUndefined();
  });

  it("shows the review even when saving it fails", async () => {
    mocks.completeHomework.mockResolvedValue({ homework: withSentence("hw-1"), reviewUpdates: [] });
    mocks.reviewSentences.mockResolvedValue(REVIEWS);
    mocks.saveHomeworkReview.mockRejectedValue(new Error("offline"));
    await renderProbe();

    await act(() => hook().submit());
    await flushAsyncWork();

    expect(hook().history[0]).toMatchObject({ review: { items: REVIEWS } });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("sends one request when a review is asked for twice at once", async () => {
    const pending = deferred<typeof REVIEWS>();
    mocks.reviewSentences.mockReturnValue(pending.promise);
    mocks.listCompletedHomeworks.mockResolvedValue([withSentence("old-1")]);
    await renderProbe();

    const old = hook().history[0] as Homework;
    await act(async () => {
      void hook().reviewHomework(old);
      void hook().reviewHomework(old);
    });
    expect(hook().reviewState["old-1"]).toBe("reviewing");
    await act(async () => pending.resolve(REVIEWS));
    expect(mocks.reviewSentences).toHaveBeenCalledTimes(1);
  });

  it("does not review a homework that already has a review", async () => {
    mocks.listCompletedHomeworks.mockResolvedValue([
      { ...withSentence("old-1"), review: { reviewedAt: 1, items: REVIEWS } },
    ]);
    await renderProbe();
    await act(() => hook().reviewHomework(hook().history[0] as Homework));
    expect(mocks.reviewSentences).not.toHaveBeenCalled();
  });
});

describe("useWordPractice submitting", () => {
  it("completes the homework, clears active and puts it first in the history", async () => {
    await renderProbe();
    const finishedAt = vi.spyOn(Date, "now").mockReturnValue(5_000);

    let result: Homework | null = null;
    await act(async () => {
      result = await hook().submit();
    });
    finishedAt.mockRestore();

    expect(mocks.completeHomework).toHaveBeenCalledWith("user-1", "hw-1", 5_000);
    expect(result).toMatchObject({ id: "hw-1", status: "completed" });
    expect(hook().active).toBeNull();
    expect(hook().history.map((item) => item.id)).toEqual(["hw-1", "old-1"]);
    expect(hook().error).toBeNull();
  });

  it("updates review stats for each graded word after submitting, without failing on errors", async () => {
    await renderProbe();
    const completed = completedHomework("hw-1");
    mocks.completeHomework.mockResolvedValue({
      homework: completed,
      reviewUpdates: [
        { vocabularyId: "a", remembered: true },
        { vocabularyId: "b", remembered: false },
      ],
    });
    mocks.updateReviewStats.mockRejectedValueOnce(new Error("quota"));

    await act(() => hook().submit());

    expect(mocks.updateReviewStats.mock.calls).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(hook().error).toBeNull();
    expect(hook().history[0].id).toBe(completed.id);
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("starts every review stat update at once and waits for all of them", async () => {
    await renderProbe();
    const first = deferred<void>();
    const second = deferred<void>();
    mocks.completeHomework.mockResolvedValue({
      homework: completedHomework("hw-1"),
      reviewUpdates: [
        { vocabularyId: "a", remembered: true },
        { vocabularyId: "b", remembered: false },
      ],
    });
    mocks.updateReviewStats.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    let finished = false;
    let submitting!: Promise<unknown>;
    await act(async () => {
      submitting = hook().submit().then(() => { finished = true; });
      await flushAsyncWork();
    });
    expect(mocks.updateReviewStats).toHaveBeenCalledTimes(2);
    expect(finished).toBe(false);

    await act(async () => {
      first.resolve();
      second.resolve();
      await submitting;
    });
    expect(finished).toBe(true);
  });

  it("recomputes the due count from the stored state after submitting", async () => {
    mocks.loadPracticeState.mockResolvedValueOnce(practiceState(3));
    await renderProbe();
    expect(hook().reviewDueCount).toBe(3);
    mocks.loadPracticeState.mockResolvedValueOnce(practiceState(5));

    await act(() => hook().submit());

    expect(hook().reviewDueCount).toBe(5);
    expect(hook().error).toBeNull();
  });

  it("still succeeds when re-reading the state after submitting fails", async () => {
    await renderProbe();
    mocks.loadPracticeState.mockRejectedValueOnce(new Error("offline"));

    let result: Homework | null = null;
    await act(async () => {
      result = await hook().submit();
    });

    expect(result).toMatchObject({ id: "hw-1" });
    expect(hook().error).toBeNull();
    expect(hook().active).toBeNull();
  });

  it("waits for the in-flight progress save before completing", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);
    const answered = progressWithCopies(2, 2);

    act(() => hook().updateProgress(answered));
    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().submit();
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
    expect(mocks.completeHomework).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve();
      await finishing;
    });

    expect(mocks.completeHomework).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.completeHomework.mock.invocationCallOrder[0],
    );
    expect(hook().active).toBeNull();
  });

  it("saves progress whose earlier save failed before completing", async () => {
    await renderProbe();
    const answered = progressWithCopies(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValueOnce(new Error("offline"));
    act(() => hook().updateProgress(answered));
    await flushAsyncWork();
    expect(hook().saveError).not.toBeNull();

    await act(async () => {
      await hook().submit();
    });

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", answered);
    expect(mocks.completeHomework).toHaveBeenCalledTimes(1);
    expect(hook().saveError).toBeNull();
    expect(hook().active).toBeNull();
  });

  it("does not complete when the last answers cannot be saved", async () => {
    await renderProbe();
    const answered = progressWithCopies(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValue(new Error("offline"));
    act(() => hook().updateProgress(answered));

    let result: Homework | null | undefined;
    await act(async () => {
      result = await hook().submit();
    });

    expect(result).toBeNull();
    expect(mocks.completeHomework).not.toHaveBeenCalled();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);
  });

  it("shares one completion between concurrent calls", async () => {
    await renderProbe();
    const pending = deferred<CompleteResult>();
    mocks.completeHomework.mockReturnValueOnce(pending.promise);

    let first!: Promise<Homework | null>;
    let second!: Promise<Homework | null>;
    act(() => {
      first = hook().submit();
      second = hook().submit();
    });
    await flushAsyncWork();
    await act(async () => {
      pending.resolve(completion("hw-1"));
      await Promise.all([first, second]);
    });

    expect(mocks.completeHomework).toHaveBeenCalledTimes(1);
    expect(await first).toMatchObject({ id: "hw-1", status: "completed" });
    expect(await second).toBe(await first);
    expect(hook().history.map((item) => item.id)).toEqual(["hw-1", "old-1"]);
  });

  it("keeps the homework and reports an error when completing fails, then allows a retry", async () => {
    await renderProbe();
    mocks.completeHomework.mockRejectedValueOnce(new Error("offline"));

    let result: Homework | null | undefined;
    await act(async () => {
      result = await hook().submit();
    });

    expect(result).toBeNull();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);
    expect(hook().history.map((item) => item.id)).toEqual(["old-1"]);

    await act(async () => {
      result = await hook().submit();
    });

    expect(result).toMatchObject({ id: "hw-1" });
    expect(hook().active).toBeNull();
    expect(hook().error).toBeNull();
    expect(mocks.completeHomework).toHaveBeenCalledTimes(2);
  });

  it("saves nothing more for a homework that has been submitted", async () => {
    await renderProbe();

    await act(async () => {
      await hook().submit();
    });
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
    expect(hook().active).toBeNull();
  });

  it("ignores answers entered while the homework is being completed", async () => {
    await renderProbe();
    const pending = deferred<CompleteResult>();
    mocks.completeHomework.mockReturnValueOnce(pending.promise);

    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().submit();
    });
    await flushAsyncWork();
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await act(async () => {
      pending.resolve(completion("hw-1"));
      await finishing;
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
  });
});

describe("useWordPractice overlapping operations", () => {
  it("keeps a homework started while the old one was being completed", async () => {
    await renderProbe();
    const pending = deferred<CompleteResult>();
    mocks.completeHomework.mockReturnValueOnce(pending.promise);
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });

    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().submit();
    });
    await flushAsyncWork();
    await act(async () => {
      await hook().start();
    });
    expect(hook().active?.id).toBe("hw-2");

    await act(async () => {
      pending.resolve(completion("hw-1"));
      await finishing;
    });

    expect(hook().active?.id).toBe("hw-2");
    expect(hook().history.map((item) => item.id)).toEqual(["hw-1", "old-1"]);
  });

  it("saves the submitting homework's last answers even if another homework became active meanwhile", async () => {
    await renderProbe();
    const firstSave = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(firstSave.promise);
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });
    const first = progressWithCopies(2, 1);
    const last = progressWithCopies(2, 2);

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(last));
    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().submit();
    });
    await act(async () => {
      await hook().start();
    });
    expect(hook().active?.id).toBe("hw-2");

    await act(async () => {
      firstSave.resolve();
      await finishing;
    });

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", last);
    expect(mocks.completeHomework).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.completeHomework.mock.invocationCallOrder[0],
    );
    expect(hook().active?.id).toBe("hw-2");
    expect(hook().saveError).toBeNull();
  });
});

describe("useWordPractice abandoning", () => {
  it("abandons the homework and clears active", async () => {
    await renderProbe();

    await act(async () => {
      await hook().abandon();
    });

    expect(mocks.abandonHomework).toHaveBeenCalledWith("user-1", "hw-1");
    expect(hook().active).toBeNull();
    expect(hook().history.map((item) => item.id)).toEqual(["old-1"]);
  });

  it("saves nothing more for an abandoned homework", async () => {
    await renderProbe();

    await act(async () => {
      await hook().abandon();
    });
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
  });

  it("skips saves that were still queued when the homework was abandoned", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);

    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    act(() => hook().updateProgress(progressWithCopies(2, 2)));
    await act(async () => {
      await hook().abandon();
    });
    await act(async () => {
      save.resolve();
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
  });

  it("keeps the homework and reports an error when abandoning fails", async () => {
    await renderProbe();
    mocks.abandonHomework.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await hook().abandon();
    });

    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);

    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
  });
});

describe("useWordPractice start", () => {
  it("makes the new homework active and reports it as created", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().start();
    });

    expect(outcome).toBe("created");
    expect(mocks.generateHomework).toHaveBeenCalledWith("user-1");
    expect(hook().active?.id).toBe("hw-2");
    expect(hook().starting).toBe(false);
  });

  it("saves progress to the new homework after it replaces the old one", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });
    await act(async () => {
      await hook().start();
    });
    const next = progressWithCopies(2, 1);

    act(() => hook().updateProgress(next));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledWith("user-1", "hw-2", next);
  });

  it("stops saving progress for the old homework once start replaced it", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    act(() => hook().updateProgress(progressWithCopies(2, 2)));
    await act(async () => {
      await hook().start();
    });
    await act(async () => {
      save.resolve();
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
  });

  it("sends no save for the old homework while a new one is being generated", async () => {
    await renderProbe();
    const generation = deferred<{ status: "created"; homework: Homework }>();
    mocks.generateHomework.mockReturnValueOnce(generation.promise);

    let pending!: ReturnType<UseWordPractice["start"]>;
    act(() => {
      pending = hook().start();
    });
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();

    await act(async () => {
      generation.resolve({ status: "created", homework: homework("hw-2") });
      await pending;
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
    expect(hook().active?.id).toBe("hw-2");
  });

  it("keeps saving the old homework when starting fails or finds nothing", async () => {
    await renderProbe();
    mocks.generateHomework.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await hook().start();
    });
    mocks.generateHomework.mockResolvedValueOnce({ status: "empty" });
    await act(async () => {
      await hook().start();
    });
    const next = progressWithCopies(2, 1);

    act(() => hook().updateProgress(next));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledWith("user-1", "hw-1", next);
  });

  it("leaves the active homework alone when there is nothing to practise", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({ status: "empty" });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().start();
    });

    expect(outcome).toBe("empty");
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().starting).toBe(false);
    expect(hook().error).toBeNull();
  });

  it("reports failure with a Chinese error and clears starting", async () => {
    await renderProbe();
    mocks.generateHomework.mockRejectedValueOnce(new Error("offline"));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().start();
    });

    expect(outcome).toBe("failed");
    expect(hook().error).toBe("準備功課失敗，請稍後再試");
    expect(hook().starting).toBe(false);
    expect(hook().active?.id).toBe("hw-1");
  });

  it("refuses a second start while one is running", async () => {
    await renderProbe();
    const generation = deferred<{ status: "created"; homework: Homework }>();
    mocks.generateHomework.mockReturnValueOnce(generation.promise);

    let first!: ReturnType<UseWordPractice["start"]>;
    act(() => {
      first = hook().start();
    });
    expect(hook().starting).toBe(true);

    let second: string | undefined;
    await act(async () => {
      second = await hook().start();
    });

    expect(second).toBe("failed");
    expect(mocks.generateHomework).toHaveBeenCalledTimes(1);

    await act(async () => {
      generation.resolve({ status: "created", homework: homework("hw-2") });
      await first;
    });

    expect(await first).toBe("created");
    expect(hook().starting).toBe(false);
  });

  it("ignores a result that arrives after the page unmounted", async () => {
    await renderProbe();
    const generation = deferred<{ status: "created"; homework: Homework }>();
    mocks.generateHomework.mockReturnValueOnce(generation.promise);

    let pending!: ReturnType<UseWordPractice["start"]>;
    act(() => {
      pending = hook().start();
    });
    act(() => root?.unmount());
    root = null;

    generation.resolve({ status: "created", homework: homework("hw-2") });
    expect(await pending).toBe("failed");
  });
});

describe("useWordPractice settings", () => {
  it("saves settings and uses them for the home card", async () => {
    mocks.loadPracticeState.mockResolvedValue(practiceState(12));
    await renderProbe();
    const next: PracticeSettings = { newWordCount: 8, reviewLimit: 4, startLevel: "B1" };

    await act(() => hook().saveSettings(next));

    expect(mocks.saveSettings).toHaveBeenCalledWith("user-1", next);
    expect(hook().settings).toEqual(next);
    expect(hook().reviewDueCount).toBe(4);
  });

  it("keeps the old settings and reports an error when saving fails", async () => {
    await renderProbe();
    mocks.saveSettings.mockRejectedValueOnce(new Error("offline"));

    await act(() => hook().saveSettings({ ...SETTINGS, newWordCount: 9 }));

    expect(hook().settings).toEqual(SETTINGS);
    expect(hook().error).toMatch(/[一-鿿]/);
  });
});

describe("useWordPractice resetting", () => {
  it("resets the progress on the server, saves nothing more for the old homework, and reloads", async () => {
    await renderProbe();
    mocks.getActiveHomework.mockResolvedValueOnce(null);

    await act(async () => {
      await hook().resetProgress();
    });

    expect(mocks.resetPracticeProgress).toHaveBeenCalledWith("user-1");
    expect(mocks.loadPracticeState).toHaveBeenCalledTimes(2);
    expect(hook().active).toBeNull();
    expect(hook().status).toBe("ready");

    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
  });

  it("keeps the homework and reports an error when resetting fails", async () => {
    await renderProbe();
    mocks.resetPracticeProgress.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await hook().resetProgress();
    });

    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);
    act(() => hook().updateProgress(progressWithCopies(2, 1)));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
  });
});
