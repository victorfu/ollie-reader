import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Homework,
  HomeworkOptions,
  HomeworkWordProgress,
} from "../types/wordPractice";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getActiveHomework: vi.fn(),
  listCompletedHomeworks: vi.fn(),
  saveHomeworkProgress: vi.fn(),
  abandonHomework: vi.fn(),
  completeHomework: vi.fn(),
  generateHomework: vi.fn(),
  fillMissingSentences: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/wordPracticeStorage", () => ({
  getActiveHomework: mocks.getActiveHomework,
  listCompletedHomeworks: mocks.listCompletedHomeworks,
  saveHomeworkProgress: mocks.saveHomeworkProgress,
  abandonHomework: mocks.abandonHomework,
  completeHomework: mocks.completeHomework,
}));
vi.mock("../services/wordPracticeService", () => ({
  generateHomework: mocks.generateHomework,
  fillMissingSentences: mocks.fillMissingSentences,
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

const OPTIONS: HomeworkOptions = { wordCount: 2, startLevel: "A1" };

function blankProgress(count: number): HomeworkWordProgress[] {
  return Array.from({ length: count }, () => ({
    learned: false,
    spellCorrect: 0,
    fill: { attempts: 0, correct: false, done: false },
    define: { attempts: 0, correct: false, done: false },
    sentence: null,
    testAnswer: null,
  }));
}

function homework(id: string, overrides: Partial<Homework> = {}): Homework {
  const words = ["apple", "river"].map((word) => ({
    key: word,
    vocabularyId: `vocab-${word}`,
    word,
    definitions: [{ partOfSpeech: "noun", definition: `a ${word}` }],
    sentence: null,
    cloze: null,
    cefr: null,
  }));
  return {
    id,
    status: "active",
    createdAt: 1_000,
    options: OPTIONS,
    words,
    progress: blankProgress(words.length),
    ...overrides,
  };
}

/** Progress where the first word has been learned, so it differs from `blankProgress`. */
function progressWithLearned(count: number, learnedCount: number): HomeworkWordProgress[] {
  return blankProgress(count).map((entry, index) => ({
    ...entry,
    learned: index < learnedCount,
  }));
}

function completedHomework(id: string): Homework {
  return homework(id, {
    status: "completed",
    completedAt: 2_000,
    result: { correctKeys: ["apple"], missedKeys: ["river"], correctCount: 1, total: 2 },
  });
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

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
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
  mocks.getActiveHomework.mockResolvedValue(homework("hw-1"));
  mocks.listCompletedHomeworks.mockResolvedValue([completedHomework("old-1")]);
  mocks.saveHomeworkProgress.mockResolvedValue(undefined);
  mocks.abandonHomework.mockResolvedValue(undefined);
  mocks.completeHomework.mockImplementation(async (_uid: string, id: string) =>
    completedHomework(id),
  );
  mocks.fillMissingSentences.mockImplementation(
    async (_uid: string, current: Homework) => current,
  );
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("useWordPractice loading", () => {
  it("reads the active homework and the history, then becomes ready", async () => {
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

    expect(mocks.getActiveHomework).toHaveBeenCalledWith("user-1");
    expect(mocks.listCompletedHomeworks).toHaveBeenCalledWith("user-1");
    expect(hook().status).toBe("ready");
    expect(hook().error).toBeNull();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().history.map((item) => item.id)).toEqual(["old-1"]);
  });

  it("stays loading and calls nothing without a signed-in user", async () => {
    mocks.useAuth.mockReturnValue({ user: null });

    await renderProbe();

    expect(hook().status).toBe("loading");
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

  it("reload re-reads both the active homework and the history", async () => {
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
});

describe("useWordPractice reload and account changes", () => {
  it("lets an in-flight progress save finish before re-reading", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);
    act(() => hook().updateProgress(progressWithLearned(2, 1)));
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
    expect(mocks.getActiveHomework).toHaveBeenLastCalledWith("user-2");
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
    const next = progressWithLearned(2, 1);

    act(() => hook().updateProgress(next));

    expect(hook().active?.progress).toBe(next);
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledWith("user-1", "hw-1", next);
    expect(hook().saveError).toBeNull();
  });

  it("reports a failed save, then resends the full latest progress and clears the error", async () => {
    await renderProbe();
    const first = progressWithLearned(2, 1);
    const second = progressWithLearned(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValueOnce(new Error("offline"));

    act(() => hook().updateProgress(first));
    await flushAsyncWork();

    expect(hook().saveError).toMatch(/[一-鿿]/);
    expect(hook().active?.progress).toBe(first);

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
    const first = progressWithLearned(2, 1);
    const second = progressWithLearned(2, 2);
    const third = blankProgress(2).map((entry) => ({ ...entry, spellCorrect: 3 }));

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(second));
    act(() => hook().updateProgress(third));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", first);
    expect(hook().active?.progress).toBe(third);

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
    const first = progressWithLearned(2, 1);
    const second = progressWithLearned(2, 2);

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
    const first = progressWithLearned(2, 1);
    const second = progressWithLearned(2, 2);

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

describe("useWordPractice sentence retry", () => {
  it("asks for missing sentences only once per homework", async () => {
    await renderProbe();

    await act(async () => {
      await hook().ensureSentences();
    });
    await act(async () => {
      await hook().ensureSentences();
    });

    expect(mocks.fillMissingSentences).toHaveBeenCalledTimes(1);
    expect(mocks.fillMissingSentences).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "hw-1" }),
      expect.any(AbortSignal),
    );
  });

  it("does not repeat a failed attempt and keeps the page error clear", async () => {
    await renderProbe();
    mocks.fillMissingSentences.mockRejectedValueOnce(new Error("quota used up"));

    await act(async () => {
      await hook().ensureSentences();
    });
    await act(async () => {
      await hook().ensureSentences();
    });

    expect(mocks.fillMissingSentences).toHaveBeenCalledTimes(1);
    expect(hook().error).toBeNull();
    expect(mocks.loggerError).toHaveBeenCalled();
    expect(hook().active?.id).toBe("hw-1");
  });

  it("replaces the active homework with the one that has sentences", async () => {
    await renderProbe();
    const withSentences = homework("hw-1");
    withSentences.words = withSentences.words.map((word) => ({
      ...word,
      sentence: `I like the ${word.word}.`,
    }));
    mocks.fillMissingSentences.mockResolvedValueOnce(withSentences);

    await act(async () => {
      await hook().ensureSentences();
    });

    expect(hook().active).toBe(withSentences);
  });

  it("keeps answers entered while the sentences were being fetched", async () => {
    await renderProbe();
    const fetching = deferred<Homework>();
    mocks.fillMissingSentences.mockReturnValueOnce(fetching.promise);
    const answered = progressWithLearned(2, 1);

    let ensured!: Promise<void>;
    act(() => {
      ensured = hook().ensureSentences();
    });
    act(() => hook().updateProgress(answered));

    const withSentences = homework("hw-1");
    withSentences.words = withSentences.words.map((word) => ({
      ...word,
      sentence: `I like the ${word.word}.`,
    }));
    await act(async () => {
      fetching.resolve(withSentences);
      await ensured;
    });

    expect(hook().active?.words).toBe(withSentences.words);
    expect(hook().active?.progress).toBe(answered);
  });

  it("ignores sentences that arrive after the homework was abandoned", async () => {
    await renderProbe();
    const fetching = deferred<Homework>();
    mocks.fillMissingSentences.mockReturnValueOnce(fetching.promise);

    let ensured!: Promise<void>;
    act(() => {
      ensured = hook().ensureSentences();
    });
    await act(async () => {
      await hook().abandon();
    });
    await act(async () => {
      fetching.resolve(homework("hw-1"));
      await ensured;
    });

    expect(hook().active).toBeNull();
  });
});

describe("useWordPractice finishing the test", () => {
  it("completes the homework, clears active and puts it first in the history", async () => {
    await renderProbe();
    const finishedAt = vi.spyOn(Date, "now").mockReturnValue(5_000);

    let result: Homework | null = null;
    await act(async () => {
      result = await hook().finishTest();
    });
    finishedAt.mockRestore();

    expect(mocks.completeHomework).toHaveBeenCalledWith("user-1", "hw-1", 5_000);
    expect(result).toMatchObject({ id: "hw-1", status: "completed" });
    expect(hook().active).toBeNull();
    expect(hook().history.map((item) => item.id)).toEqual(["hw-1", "old-1"]);
    expect(hook().error).toBeNull();
  });

  it("waits for the in-flight progress save before completing", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);
    const answered = progressWithLearned(2, 2);

    act(() => hook().updateProgress(answered));
    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().finishTest();
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
    const answered = progressWithLearned(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValueOnce(new Error("offline"));
    act(() => hook().updateProgress(answered));
    await flushAsyncWork();
    expect(hook().saveError).not.toBeNull();

    await act(async () => {
      await hook().finishTest();
    });

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(2);
    expect(mocks.saveHomeworkProgress).toHaveBeenLastCalledWith("user-1", "hw-1", answered);
    expect(mocks.completeHomework).toHaveBeenCalledTimes(1);
    expect(hook().saveError).toBeNull();
    expect(hook().active).toBeNull();
  });

  it("does not complete when the last answers cannot be saved", async () => {
    await renderProbe();
    const answered = progressWithLearned(2, 2);
    mocks.saveHomeworkProgress.mockRejectedValue(new Error("offline"));
    act(() => hook().updateProgress(answered));

    let result: Homework | null | undefined;
    await act(async () => {
      result = await hook().finishTest();
    });

    expect(result).toBeNull();
    expect(mocks.completeHomework).not.toHaveBeenCalled();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);
  });

  it("shares one completion between concurrent calls", async () => {
    await renderProbe();
    const completion = deferred<Homework>();
    mocks.completeHomework.mockReturnValueOnce(completion.promise);

    let first!: Promise<Homework | null>;
    let second!: Promise<Homework | null>;
    act(() => {
      first = hook().finishTest();
      second = hook().finishTest();
    });
    await flushAsyncWork();
    await act(async () => {
      completion.resolve(completedHomework("hw-1"));
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
      result = await hook().finishTest();
    });

    expect(result).toBeNull();
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().error).toMatch(/[一-鿿]/);
    expect(hook().history.map((item) => item.id)).toEqual(["old-1"]);

    await act(async () => {
      result = await hook().finishTest();
    });

    expect(result).toMatchObject({ id: "hw-1" });
    expect(hook().active).toBeNull();
    expect(hook().error).toBeNull();
    expect(mocks.completeHomework).toHaveBeenCalledTimes(2);
  });

  it("saves nothing more for a homework that has been finished", async () => {
    await renderProbe();

    await act(async () => {
      await hook().finishTest();
    });
    act(() => hook().updateProgress(progressWithLearned(2, 1)));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
    expect(hook().active).toBeNull();
  });

  it("ignores answers entered while the test is being completed", async () => {
    await renderProbe();
    const completion = deferred<Homework>();
    mocks.completeHomework.mockReturnValueOnce(completion.promise);

    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().finishTest();
    });
    await flushAsyncWork();
    act(() => hook().updateProgress(progressWithLearned(2, 1)));
    await act(async () => {
      completion.resolve(completedHomework("hw-1"));
      await finishing;
    });
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
  });
});

describe("useWordPractice overlapping operations", () => {
  it("keeps a homework generated while the old one was being completed", async () => {
    await renderProbe();
    const completion = deferred<Homework>();
    mocks.completeHomework.mockReturnValueOnce(completion.promise);
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });

    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().finishTest();
    });
    await flushAsyncWork();
    await act(async () => {
      await hook().generate(OPTIONS);
    });
    expect(hook().active?.id).toBe("hw-2");

    await act(async () => {
      completion.resolve(completedHomework("hw-1"));
      await finishing;
    });

    expect(hook().active?.id).toBe("hw-2");
    expect(hook().history.map((item) => item.id)).toEqual(["hw-1", "old-1"]);
  });

  it("saves the finishing homework's last answers even if another homework became active meanwhile", async () => {
    await renderProbe();
    const firstSave = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(firstSave.promise);
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });
    const first = progressWithLearned(2, 1);
    const last = progressWithLearned(2, 2);

    act(() => hook().updateProgress(first));
    await flushAsyncWork();
    act(() => hook().updateProgress(last));
    let finishing!: Promise<Homework | null>;
    act(() => {
      finishing = hook().finishTest();
    });
    await act(async () => {
      await hook().generate(OPTIONS);
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
    act(() => hook().updateProgress(progressWithLearned(2, 1)));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).not.toHaveBeenCalled();
  });

  it("skips saves that were still queued when the homework was abandoned", async () => {
    await renderProbe();
    const save = deferred<void>();
    mocks.saveHomeworkProgress.mockReturnValueOnce(save.promise);

    act(() => hook().updateProgress(progressWithLearned(2, 1)));
    await flushAsyncWork();
    act(() => hook().updateProgress(progressWithLearned(2, 2)));
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

    act(() => hook().updateProgress(progressWithLearned(2, 1)));
    await flushAsyncWork();
    expect(mocks.saveHomeworkProgress).toHaveBeenCalledTimes(1);
  });
});

describe("useWordPractice generate", () => {
  it("makes the new homework active and reports it as created", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().generate(OPTIONS);
    });

    expect(outcome).toBe("created");
    expect(mocks.generateHomework).toHaveBeenCalledWith(
      "user-1",
      OPTIONS,
      expect.any(AbortSignal),
    );
    expect(hook().active?.id).toBe("hw-2");
    expect(hook().generating).toBe(false);
  });

  it("saves progress to the new homework after it replaces the old one", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({
      status: "created",
      homework: homework("hw-2"),
    });
    await act(async () => {
      await hook().generate(OPTIONS);
    });
    const next = progressWithLearned(2, 1);

    act(() => hook().updateProgress(next));
    await flushAsyncWork();

    expect(mocks.saveHomeworkProgress).toHaveBeenCalledWith("user-1", "hw-2", next);
  });

  it("leaves the active homework alone when there is nothing to practise", async () => {
    await renderProbe();
    mocks.generateHomework.mockResolvedValueOnce({ status: "empty" });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().generate(OPTIONS);
    });

    expect(outcome).toBe("empty");
    expect(hook().active?.id).toBe("hw-1");
    expect(hook().generating).toBe(false);
    expect(hook().error).toBeNull();
  });

  it("reports failure with a Chinese error and clears generating", async () => {
    await renderProbe();
    mocks.generateHomework.mockRejectedValueOnce(new Error("Gemini down"));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().generate(OPTIONS);
    });

    expect(outcome).toBe("failed");
    expect(hook().error).toMatch(/[一-鿿]/);
    expect(hook().generating).toBe(false);
    expect(hook().active?.id).toBe("hw-1");
  });

  it("refuses a second generate while one is running", async () => {
    await renderProbe();
    const generation = deferred<{ status: "created"; homework: Homework }>();
    mocks.generateHomework.mockReturnValueOnce(generation.promise);

    let first!: ReturnType<UseWordPractice["generate"]>;
    act(() => {
      first = hook().generate(OPTIONS);
    });
    expect(hook().generating).toBe(true);

    let second: string | undefined;
    await act(async () => {
      second = await hook().generate(OPTIONS);
    });

    expect(second).toBe("failed");
    expect(mocks.generateHomework).toHaveBeenCalledTimes(1);

    await act(async () => {
      generation.resolve({ status: "created", homework: homework("hw-2") });
      await first;
    });

    expect(await first).toBe("created");
    expect(hook().generating).toBe(false);
  });

  it("treats an abort as cancellation without an error", async () => {
    await renderProbe();
    mocks.generateHomework.mockRejectedValueOnce(abortError());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await hook().generate(OPTIONS);
    });

    expect(outcome).toBe("failed");
    expect(hook().error).toBeNull();
    expect(hook().generating).toBe(false);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("aborts a running generation when the page unmounts", async () => {
    await renderProbe();
    const generation = deferred<{ status: "created"; homework: Homework }>();
    mocks.generateHomework.mockReturnValueOnce(generation.promise);

    let pending!: ReturnType<UseWordPractice["generate"]>;
    act(() => {
      pending = hook().generate(OPTIONS);
    });
    const signal = mocks.generateHomework.mock.calls[0][2] as AbortSignal;
    expect(signal.aborted).toBe(false);

    act(() => root?.unmount());
    root = null;

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: "AbortError" });

    generation.reject(abortError());
    expect(await pending).toBe("failed");
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });
});
