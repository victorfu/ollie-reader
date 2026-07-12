import { describe, expect, it } from "vitest";
import {
  clearSubjectProgress,
  EXAM_PROGRESS_PREFIX,
  examProgressKey,
  readScopeProgress,
  recordSessionResult,
} from "./examProgressStorage";

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("examProgressKey", () => {
  it("uses the versioned prefix", () => {
    expect(examProgressKey("chinese", "chi-s1")).toBe(
      `${EXAM_PROGRESS_PREFIX}:chinese:chi-s1`,
    );
    expect(EXAM_PROGRESS_PREFIX).toMatch(/-v1$/);
  });
});

describe("readScopeProgress", () => {
  it("returns null when nothing stored", () => {
    expect(readScopeProgress("math", "math-p1", createMemoryStorage())).toBeNull();
  });

  it("returns null for corrupted JSON without throwing", () => {
    const storage = createMemoryStorage({
      [examProgressKey("math", "math-p1")]: "{not json",
    });
    expect(readScopeProgress("math", "math-p1", storage)).toBeNull();
  });

  it("returns null for schema-mismatched payloads", () => {
    const storage = createMemoryStorage({
      [examProgressKey("math", "math-p1")]: JSON.stringify({
        bestScore: "high",
        lastWrongIds: [123],
      }),
    });
    expect(readScopeProgress("math", "math-p1", storage)).toBeNull();
  });

  it("returns null when storage is unavailable", () => {
    expect(readScopeProgress("math", "math-p1", null)).toBeNull();
  });

  it("round-trips a recorded result", () => {
    const storage = createMemoryStorage();
    recordSessionResult(
      {
        subject: "math",
        scopeId: "math-p1",
        mode: "normal",
        score: 20,
        total: 25,
        wrongIds: ["math-003", "math-007"],
      },
      storage,
    );
    const progress = readScopeProgress("math", "math-p1", storage);
    expect(progress).toMatchObject({
      bestScore: 20,
      bestTotal: 25,
      lastScore: 20,
      lastTotal: 25,
      lastWrongIds: ["math-003", "math-007"],
    });
  });
});

describe("clearSubjectProgress", () => {
  it("removes every scope for one subject and preserves other data", () => {
    const mathSection = examProgressKey("math", "math-p1");
    const mathFull = examProgressKey("math", "full");
    const chineseSection = examProgressKey("chinese", "chi-s1");
    const storage = createMemoryStorage({
      [mathSection]: "section",
      [mathFull]: "full",
      [chineseSection]: "chinese",
      "unrelated-key": "keep",
    });

    expect(clearSubjectProgress("math", storage)).toBe(2);
    expect(storage.getItem(mathSection)).toBeNull();
    expect(storage.getItem(mathFull)).toBeNull();
    expect(storage.getItem(chineseSection)).toBe("chinese");
    expect(storage.getItem("unrelated-key")).toBe("keep");
  });

  it("is safe when storage is unavailable", () => {
    expect(clearSubjectProgress("chinese", null)).toBe(0);
  });

  it("does not throw when storage access is blocked", () => {
    const blockedStorage = {
      get length(): number {
        throw new Error("blocked");
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } satisfies Storage;

    expect(clearSubjectProgress("math", blockedStorage)).toBe(0);
  });
});

describe("recordSessionResult", () => {
  const base = {
    subject: "math" as const,
    scopeId: "math-p1",
    total: 25,
  };

  it("flags the first scoring normal run as a new best", () => {
    const storage = createMemoryStorage();
    const { isNewBest } = recordSessionResult(
      { ...base, mode: "normal", score: 18, wrongIds: [] },
      storage,
    );
    expect(isNewBest).toBe(true);
  });

  it("does not flag a zero score as a new best", () => {
    const storage = createMemoryStorage();
    const { isNewBest } = recordSessionResult(
      { ...base, mode: "normal", score: 0, wrongIds: ["math-001"] },
      storage,
    );
    expect(isNewBest).toBe(false);
  });

  it("only raises best when the score improves", () => {
    const storage = createMemoryStorage();
    recordSessionResult({ ...base, mode: "normal", score: 20, wrongIds: [] }, storage);
    const worse = recordSessionResult(
      { ...base, mode: "normal", score: 15, wrongIds: ["math-001"] },
      storage,
    );
    expect(worse.isNewBest).toBe(false);
    expect(worse.progress.bestScore).toBe(20);
    expect(worse.progress.lastScore).toBe(15);

    const better = recordSessionResult(
      { ...base, mode: "normal", score: 24, wrongIds: [] },
      storage,
    );
    expect(better.isNewBest).toBe(true);
    expect(better.progress.bestScore).toBe(24);
  });

  it("never lets retry sessions touch the best score but always updates wrong ids", () => {
    const storage = createMemoryStorage();
    recordSessionResult(
      { ...base, mode: "normal", score: 20, wrongIds: ["math-001", "math-002"] },
      storage,
    );
    const retry = recordSessionResult(
      { ...base, mode: "retry", score: 1, total: 2, wrongIds: ["math-002"] },
      storage,
    );
    expect(retry.isNewBest).toBe(false);
    expect(retry.progress.bestScore).toBe(20);
    expect(retry.progress.bestTotal).toBe(25);
    expect(retry.progress.lastScore).toBe(1);
    expect(retry.progress.lastTotal).toBe(2);
    expect(retry.progress.lastWrongIds).toEqual(["math-002"]);
  });

  it("keeps best empty when the only runs are retries", () => {
    const storage = createMemoryStorage();
    const { progress, isNewBest } = recordSessionResult(
      { ...base, mode: "retry", score: 2, total: 3, wrongIds: [] },
      storage,
    );
    expect(isNewBest).toBe(false);
    expect(progress.bestScore).toBe(0);
    expect(progress.bestTotal).toBe(0);
  });

  it("still returns the outcome when storage is unavailable", () => {
    const { progress } = recordSessionResult(
      { ...base, mode: "normal", score: 10, wrongIds: [] },
      null,
    );
    expect(progress.lastScore).toBe(10);
  });
});
