import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CefrLevel, Homework, HomeworkWord, HomeworkWordProgress, WordPracticeState } from "../types/wordPractice";

type Data = Record<string, unknown>;
interface Constraint {
  field?: string;
  direction?: string;
  max?: number;
}
interface Ref {
  path: string;
  id: string;
  isCollection?: boolean;
  constraints?: Constraint[];
}

const m = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), tail: Promise.resolve() as Promise<unknown>, autoId: 0 }));
vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
// In-memory Firestore. It mimics the behaviours the storage layer depends on:
// writes are applied only when a transaction commits, reads after writes are
// rejected, `undefined` field values are rejected, `update` reads dots in a key
// as a field path, and `orderBy` skips documents that lack the field.
vi.mock("firebase/firestore", () => {
  const ref = (path: string): Ref => ({ path, id: path.split("/").at(-1) as string });
  const clone = (data: Data): Data => structuredClone(data);
  const assertDefined = (value: unknown, where = "data"): void => {
    if (value === undefined) throw new Error(`Unsupported field value: undefined (found in ${where})`);
    if (Array.isArray(value)) value.forEach((item, i) => assertDefined(item, `${where}[${i}]`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => assertDefined(v, `${where}.${k}`));
  };
  const snapshot = (path: string) => ({
    id: path.split("/").at(-1),
    exists: () => m.docs.has(path),
    data: () => (m.docs.has(path) ? clone(m.docs.get(path) as Data) : undefined),
  });
  const write = (path: string, data: Data) => { assertDefined(data); m.docs.set(path, clone(data)); };
  const merge = (path: string, data: Data) => {
    assertDefined(data);
    const current = m.docs.get(path);
    if (!current) throw new Error(`No document to update: ${path}`);
    const next = clone(current);
    for (const [field, value] of Object.entries(clone(data))) {
      const keys = field.split(".");
      const last = keys.pop() as string;
      const target = keys.reduce<Data>((node, key) => (node[key] ??= {}) as Data, next);
      target[last] = value;
    }
    m.docs.set(path, next);
  };
  return {
    collection: (_db: unknown, ...parts: string[]): Ref => ({ ...ref(parts.join("/")), isCollection: true }),
    doc: (first: Ref | unknown, ...parts: string[]): Ref => {
      const parent = first as Ref;
      if (parent.isCollection) return ref(parts.length ? `${parent.path}/${parts.join("/")}` : `${parent.path}/auto-${++m.autoId}`);
      return ref(parts.join("/"));
    },
    orderBy: (field: string, direction: string) => ({ field, direction }),
    limit: (max: number) => ({ max }),
    query: (collectionRef: Ref, ...constraints: Constraint[]): Ref => ({ ...collectionRef, constraints }),
    getDoc: async (r: Ref) => snapshot(r.path),
    setDoc: async (r: Ref, data: Data) => write(r.path, data),
    updateDoc: async (r: Ref, data: Data) => merge(r.path, data),
    getDocs: async (q: Ref) => {
      const order = q.constraints?.find((c) => c.field);
      const max = q.constraints?.find((c) => c.max !== undefined)?.max ?? Infinity;
      const prefix = `${q.path}/`;
      const rows = [...m.docs.entries()]
        .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .filter(([, data]) => !order?.field || data[order.field] !== undefined)
        .sort(([, a], [, b]) => {
          const field = order?.field as string;
          return (order?.direction === "desc" ? -1 : 1) * ((a[field] as number) - (b[field] as number));
        });
      return { docs: rows.slice(0, max).map(([path]) => snapshot(path)) };
    },
    runTransaction: (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const run = async () => {
        const commits: (() => void)[] = [];
        const tx = {
          get: async (r: Ref) => {
            if (commits.length) throw new Error("Firestore transactions require all reads to be executed before all writes.");
            return snapshot(r.path);
          },
          set: (r: Ref, data: Data) => { assertDefined(data); commits.push(() => write(r.path, data)); return tx; },
          update: (r: Ref, data: Data) => {
            assertDefined(data);
            if (!m.docs.has(r.path)) throw new Error(`No document to update: ${r.path}`);
            commits.push(() => merge(r.path, data));
            return tx;
          },
        };
        const result = await fn(tx);
        commits.forEach((commit) => commit());
        return result;
      };
      const task = m.tail.then(run);
      m.tail = task.then(() => undefined, () => undefined);
      return task;
    },
  };
});

import {
  EMPTY_PRACTICE_STATE,
  abandonHomework,
  completeHomework,
  createHomework,
  getActiveHomework,
  listCompletedHomeworks,
  loadPracticeState,
  newHomeworkId,
  saveCefrEstimates,
  saveHomeworkProgress,
  saveHomeworkWords,
} from "./wordPracticeStorage";

const UID = "u1";
const stateOf = (uid = UID): WordPracticeState => m.docs.get(`users/${uid}/wordPractice/state`) as unknown as WordPracticeState;
const homeworkDoc = (id: string, uid = UID): Data | undefined => m.docs.get(`users/${uid}/wordHomeworks/${id}`);
const seedState = (state: unknown, uid = UID) => m.docs.set(`users/${uid}/wordPractice/state`, state as Data);
const seedHomework = (hw: Homework, uid = UID) => m.docs.set(`users/${uid}/wordHomeworks/${hw.id}`, structuredClone(hw) as unknown as Data);

const word = (text: string, key = text): HomeworkWord => ({
  key,
  vocabularyId: `v-${key}`,
  word: text,
  definitions: [{ partOfSpeech: "noun", definition: `meaning of ${text}` }],
  sentence: null,
  cloze: null,
  cefr: { level: "A1", source: "list" },
});

const progressFor = (testAnswer: string | null): HomeworkWordProgress => ({
  learned: true,
  spellCorrect: 3,
  fill: { attempts: 1, correct: true, done: true },
  define: { attempts: 1, correct: true, done: true },
  sentence: { text: "A sentence.", feedback: null },
  testAnswer,
});

/** An active homework whose test answers are `answers`, one per word (null = unanswered). */
const homework = (id: string, words: HomeworkWord[], answers: (string | null)[], extra: Partial<Homework> = {}): Homework => ({
  id,
  status: "active",
  createdAt: 1_000,
  options: { wordCount: words.length, startLevel: "A1" },
  words,
  progress: answers.map(progressFor),
  ...extra,
});

const apple = word("apple");
const book = word("book");
const cat = word("cat");

beforeEach(() => {
  m.docs.clear();
  m.tail = Promise.resolve();
  m.autoId = 0;
});

describe("loadPracticeState", () => {
  it("returns the empty state when there is no state document", async () => {
    expect(await loadPracticeState(UID)).toEqual(EMPTY_PRACTICE_STATE);
    expect(EMPTY_PRACTICE_STATE).toEqual({ activeHomeworkId: null, words: {}, cefrEstimates: {} });
  });

  it("does not hand out the shared empty state, so callers cannot mutate it", async () => {
    const first = await loadPracticeState(UID);
    first.words.apple = { missCount: 1 };
    expect(await loadPracticeState(UID)).toEqual({ activeHomeworkId: null, words: {}, cefrEstimates: {} });
    expect(EMPTY_PRACTICE_STATE.words).toEqual({});
  });

  it("returns a well-formed stored state as it is", async () => {
    const stored: WordPracticeState = {
      activeHomeworkId: "hw1",
      words: { apple: { missCount: 2, learnedAt: 10, lastMissedAt: 20 }, book: { missCount: 0 } },
      cefrEstimates: { zebra: "B2", yak: "C1" },
    };
    seedState(stored);
    expect(await loadPracticeState(UID)).toEqual(stored);
  });

  it("defaults every field of a malformed state document", async () => {
    seedState({ activeHomeworkId: 42, words: "oops", cefrEstimates: ["A1"] });
    expect(await loadPracticeState(UID)).toEqual(EMPTY_PRACTICE_STATE);
    seedState({ words: null });
    expect(await loadPracticeState(UID)).toEqual(EMPTY_PRACTICE_STATE);
    seedState({ activeHomeworkId: "", words: [], cefrEstimates: null });
    expect(await loadPracticeState(UID)).toEqual(EMPTY_PRACTICE_STATE);
  });

  it("drops cefrEstimates whose value is not a CEFR level", async () => {
    seedState({ activeHomeworkId: null, words: {}, cefrEstimates: { a: "A1", b: "D9", c: 3, d: "a1", e: null, f: "C2" } });
    expect((await loadPracticeState(UID)).cefrEstimates).toEqual({ a: "A1", f: "C2" });
  });

  it("drops words entries that are not objects and repairs the others", async () => {
    seedState({
      activeHomeworkId: null,
      words: {
        good: { missCount: 2, learnedAt: 5, lastMissedAt: 6 },
        text: "learned",
        nothing: null,
        list: [1, 2],
        noMissCount: { learnedAt: 7 },
        badNumbers: { missCount: "3", learnedAt: "yesterday", lastMissedAt: null },
      },
      cefrEstimates: {},
    });
    expect((await loadPracticeState(UID)).words).toEqual({
      good: { missCount: 2, learnedAt: 5, lastMissedAt: 6 },
      noMissCount: { missCount: 0, learnedAt: 7 },
      badNumbers: { missCount: 0 },
    });
  });
});

describe("newHomeworkId", () => {
  it("returns a fresh non-empty id on every call", () => {
    const a = newHomeworkId(UID);
    const b = newHomeworkId(UID);
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("saveCefrEstimates", () => {
  it("merges with existing estimates and keeps words and activeHomeworkId", async () => {
    seedState({ activeHomeworkId: "hw1", words: { apple: { missCount: 1, learnedAt: 3 } }, cefrEstimates: { zebra: "B2", yak: "C1" } });
    await saveCefrEstimates(UID, { yak: "C2", quokka: "B1" });
    expect(stateOf()).toEqual({
      activeHomeworkId: "hw1",
      words: { apple: { missCount: 1, learnedAt: 3 } },
      cefrEstimates: { zebra: "B2", yak: "C2", quokka: "B1" },
    });
  });

  it("creates the state document when none exists", async () => {
    await saveCefrEstimates(UID, { zebra: "B2" });
    expect(stateOf()).toEqual({ activeHomeworkId: null, words: {}, cefrEstimates: { zebra: "B2" } });
  });

  it("never stores a value that is not a CEFR level", async () => {
    await saveCefrEstimates(UID, { zebra: "B2", yak: "Z9" as CefrLevel });
    expect(stateOf().cefrEstimates).toEqual({ zebra: "B2" });
  });

  it("repairs a malformed state document while saving", async () => {
    seedState({ activeHomeworkId: 7, words: null, cefrEstimates: { a: "nope", b: "A2" } });
    await saveCefrEstimates(UID, { c: "C1" });
    expect(stateOf()).toEqual({ activeHomeworkId: null, words: {}, cefrEstimates: { b: "A2", c: "C1" } });
  });
});

describe("createHomework and getActiveHomework", () => {
  it("stores the homework as active and points the state at it", async () => {
    const hw = homework("hw1", [apple], [null]);
    await createHomework(UID, hw);
    expect(homeworkDoc("hw1")).toEqual(hw);
    expect(stateOf().activeHomeworkId).toBe("hw1");
    expect(await getActiveHomework(UID)).toEqual(hw);
  });

  it("abandons the previous active homework and makes the new one active", async () => {
    const first = homework("hw1", [apple], [null]);
    const second = homework("hw2", [book], [null]);
    await createHomework(UID, first);
    await createHomework(UID, second);
    expect(homeworkDoc("hw1")).toMatchObject({ id: "hw1", status: "abandoned" });
    expect(stateOf().activeHomeworkId).toBe("hw2");
    expect(await getActiveHomework(UID)).toEqual(second);
  });

  it("keeps the learned state of words when it replaces a homework", async () => {
    seedState({ activeHomeworkId: null, words: { apple: { missCount: 1, learnedAt: 3 } }, cefrEstimates: { zebra: "B2" } });
    await createHomework(UID, homework("hw1", [apple], [null]));
    await createHomework(UID, homework("hw2", [book], [null]));
    expect(stateOf()).toEqual({ activeHomeworkId: "hw2", words: { apple: { missCount: 1, learnedAt: 3 } }, cefrEstimates: { zebra: "B2" } });
  });

  it("leaves a previous homework alone when it is no longer active", async () => {
    const done = homework("old", [apple], ["apple"], { status: "completed", completedAt: 5 });
    seedHomework(done);
    seedState({ activeHomeworkId: "old", words: {}, cefrEstimates: {} });
    await createHomework(UID, homework("hw2", [book], [null]));
    expect(homeworkDoc("old")).toEqual(done);
    expect(stateOf().activeHomeworkId).toBe("hw2");
  });

  it("repairs a malformed state document while creating", async () => {
    seedState({ activeHomeworkId: 7, words: "x", cefrEstimates: { a: "bad" } });
    await createHomework(UID, homework("hw1", [apple], [null]));
    expect(stateOf()).toEqual({ activeHomeworkId: "hw1", words: {}, cefrEstimates: {} });
  });

  it("keeps exactly one active homework when two are created at once", async () => {
    await Promise.all([createHomework(UID, homework("hwA", [apple], [null])), createHomework(UID, homework("hwB", [book], [null]))]);
    const statuses = [homeworkDoc("hwA")?.status, homeworkDoc("hwB")?.status];
    expect(statuses.filter((s) => s === "active")).toHaveLength(1);
    expect(statuses.filter((s) => s === "abandoned")).toHaveLength(1);
    expect((await getActiveHomework(UID))?.id).toBe(stateOf().activeHomeworkId);
  });

  it("returns null when there is no state, a dangling pointer, or a pointer to a finished homework", async () => {
    expect(await getActiveHomework(UID)).toBeNull();
    seedState({ activeHomeworkId: null, words: {}, cefrEstimates: {} });
    expect(await getActiveHomework(UID)).toBeNull();
    seedState({ activeHomeworkId: "ghost", words: {}, cefrEstimates: {} });
    expect(await getActiveHomework(UID)).toBeNull();
    seedHomework(homework("hw1", [apple], ["apple"], { status: "completed", completedAt: 5 }));
    seedState({ activeHomeworkId: "hw1", words: {}, cefrEstimates: {} });
    expect(await getActiveHomework(UID)).toBeNull();
    seedHomework(homework("hw2", [apple], [null], { status: "abandoned" }));
    seedState({ activeHomeworkId: "hw2", words: {}, cefrEstimates: {} });
    expect(await getActiveHomework(UID)).toBeNull();
  });

  it("writes no undefined values for absent optional fields", async () => {
    const hw = homework("hw1", [{ ...apple, emoji: undefined }], [null]);
    hw.progress[0].sentence = { text: "An apple.", feedback: { usedCorrectly: true, feedback: "Good.", suggestion: undefined } };
    await expect(createHomework(UID, hw)).resolves.toBeUndefined();
    const stored = homeworkDoc("hw1") as unknown as Homework;
    expect(stored.words[0]).not.toHaveProperty("emoji");
    expect(stored.progress[0].sentence?.feedback).not.toHaveProperty("suggestion");
    expect(stored).not.toHaveProperty("completedAt");
    expect(stored).not.toHaveProperty("result");
  });
});

describe("saveHomeworkProgress and saveHomeworkWords", () => {
  it("replaces only the progress field", async () => {
    const hw = homework("hw1", [apple, book], [null, null]);
    seedHomework(hw);
    const progress = [progressFor("apple"), progressFor(null)];
    await saveHomeworkProgress(UID, "hw1", progress);
    expect(homeworkDoc("hw1")).toEqual({ ...hw, progress });
  });

  it("replaces only the words field", async () => {
    const hw = homework("hw1", [apple, book], [null, null]);
    seedHomework(hw);
    const words = [{ ...apple, sentence: "I ate an apple." }, book];
    await saveHomeworkWords(UID, "hw1", words);
    expect(homeworkDoc("hw1")).toEqual({ ...hw, words });
  });

  it("writes no undefined values", async () => {
    seedHomework(homework("hw1", [apple], [null]));
    const progress = [{ ...progressFor(null), sentence: { text: "x", feedback: { usedCorrectly: false, feedback: "No.", suggestion: undefined } } }];
    await expect(saveHomeworkProgress(UID, "hw1", progress)).resolves.toBeUndefined();
    await expect(saveHomeworkWords(UID, "hw1", [{ ...apple, emoji: undefined }])).resolves.toBeUndefined();
    const stored = homeworkDoc("hw1") as unknown as Homework;
    expect(stored.progress[0].sentence?.feedback).not.toHaveProperty("suggestion");
    expect(stored.words[0]).not.toHaveProperty("emoji");
  });

  it("does not create a homework that does not exist", async () => {
    await expect(saveHomeworkProgress(UID, "ghost", [progressFor(null)])).rejects.toThrow();
    expect(homeworkDoc("ghost")).toBeUndefined();
  });
});

describe("completeHomework", () => {
  it("grades the test, completes the homework and updates the state in one go", async () => {
    seedState({
      activeHomeworkId: null,
      words: { book: { missCount: 2, lastMissedAt: 50 }, cat: { missCount: 1, learnedAt: 40, lastMissedAt: 45 } },
      cefrEstimates: { zebra: "B2" },
    });
    await createHomework(UID, homework("hw1", [apple, book, cat], ["apple", "bok", "CAT"]));

    const completed = await completeHomework(UID, "hw1", 9_000);

    const result = { correctKeys: ["apple", "cat"], missedKeys: ["book"], correctCount: 2, total: 3 };
    expect(completed).toMatchObject({ id: "hw1", status: "completed", completedAt: 9_000, result });
    expect(homeworkDoc("hw1")).toMatchObject({ id: "hw1", status: "completed", completedAt: 9_000, result });
    expect(stateOf()).toEqual({
      activeHomeworkId: null,
      words: {
        apple: { missCount: 0, learnedAt: 9_000 },
        book: { missCount: 3, lastMissedAt: 9_000 },
        cat: { missCount: 1, learnedAt: 9_000, lastMissedAt: 45 },
      },
      cefrEstimates: { zebra: "B2" },
    });
    expect(await getActiveHomework(UID)).toBeNull();
  });

  it("returns the stored homework document", async () => {
    await createHomework(UID, homework("hw1", [apple], ["apple"]));
    expect(await completeHomework(UID, "hw1", 9_000)).toEqual(homeworkDoc("hw1"));
  });

  it("is idempotent: a second call counts the misses once and returns the first result", async () => {
    await createHomework(UID, homework("hw1", [apple, book], ["apple", "wrong"]));
    const first = await completeHomework(UID, "hw1", 9_000);
    const stateAfterFirst = structuredClone(stateOf());
    const second = await completeHomework(UID, "hw1", 99_000);
    expect(second).toEqual(first);
    expect(second.completedAt).toBe(9_000);
    expect(stateOf()).toEqual(stateAfterFirst);
    expect(stateOf().words.book.missCount).toBe(1);
  });

  it("counts the misses once when two calls race", async () => {
    await createHomework(UID, homework("hw1", [book], ["wrong"]));
    const [a, b] = await Promise.all([completeHomework(UID, "hw1", 9_000), completeHomework(UID, "hw1", 9_500)]);
    expect(b).toEqual(a);
    expect(stateOf().words.book).toEqual({ missCount: 1, lastMissedAt: 9_000 });
  });

  it("leaves activeHomeworkId alone when it points at a different homework", async () => {
    seedHomework(homework("old", [apple], ["apple"]));
    seedState({ activeHomeworkId: "newer", words: {}, cefrEstimates: {} });
    await completeHomework(UID, "old", 9_000);
    expect(stateOf().activeHomeworkId).toBe("newer");
    expect(stateOf().words.apple).toEqual({ missCount: 0, learnedAt: 9_000 });
  });

  it("rejects an abandoned homework and changes nothing", async () => {
    await createHomework(UID, homework("hw1", [apple], ["apple"]));
    await abandonHomework(UID, "hw1");
    const before = structuredClone([...m.docs.entries()]);
    await expect(completeHomework(UID, "hw1", 9_000)).rejects.toThrow();
    expect([...m.docs.entries()]).toEqual(before);
  });

  it("rejects a homework that does not exist", async () => {
    await expect(completeHomework(UID, "ghost", 9_000)).rejects.toThrow();
  });

  it("rejects a test with unanswered words and writes nothing", async () => {
    await createHomework(UID, homework("hw1", [apple, book], ["apple", null]));
    const before = structuredClone([...m.docs.entries()]);
    await expect(completeHomework(UID, "hw1", 9_000)).rejects.toThrow();
    expect([...m.docs.entries()]).toEqual(before);
    expect((await getActiveHomework(UID))?.status).toBe("active");
  });

  it("repairs malformed word entries it reads from the state", async () => {
    seedHomework(homework("hw1", [apple, book, cat], ["x", "x", "cat"]));
    seedState({ activeHomeworkId: "hw1", words: { apple: "learned", book: { learnedAt: 4 }, cat: null }, cefrEstimates: {} });
    await completeHomework(UID, "hw1", 9_000);
    expect(stateOf().words).toEqual({
      apple: { missCount: 1, lastMissedAt: 9_000 },
      book: { missCount: 1, learnedAt: 4, lastMissedAt: 9_000 },
      cat: { missCount: 0, learnedAt: 9_000 },
    });
  });
});

describe("abandonHomework", () => {
  it("marks the homework abandoned and clears the active pointer", async () => {
    await createHomework(UID, homework("hw1", [apple], [null]));
    await abandonHomework(UID, "hw1");
    expect(homeworkDoc("hw1")).toMatchObject({ id: "hw1", status: "abandoned" });
    expect(stateOf().activeHomeworkId).toBeNull();
    expect(await getActiveHomework(UID)).toBeNull();
  });

  it("does not touch the learned state of any word", async () => {
    seedState({ activeHomeworkId: null, words: { apple: { missCount: 1, learnedAt: 3 } }, cefrEstimates: { zebra: "B2" } });
    await createHomework(UID, homework("hw1", [apple], [null]));
    await abandonHomework(UID, "hw1");
    expect(stateOf()).toEqual({ activeHomeworkId: null, words: { apple: { missCount: 1, learnedAt: 3 } }, cefrEstimates: { zebra: "B2" } });
  });

  it("leaves a newer active homework in place when an older one is abandoned", async () => {
    seedHomework(homework("old", [apple], [null]));
    seedState({ activeHomeworkId: "newer", words: {}, cefrEstimates: {} });
    await abandonHomework(UID, "old");
    expect(homeworkDoc("old")).toMatchObject({ status: "abandoned" });
    expect(stateOf().activeHomeworkId).toBe("newer");
  });

  it("is a no-op for a homework that is not active", async () => {
    await createHomework(UID, homework("hw1", [apple], ["apple"]));
    await completeHomework(UID, "hw1", 9_000);
    seedState({ ...stateOf(), activeHomeworkId: "other" });
    const before = structuredClone([...m.docs.entries()]);
    await abandonHomework(UID, "hw1");
    await abandonHomework(UID, "ghost");
    expect([...m.docs.entries()]).toEqual(before);
  });
});

describe("listCompletedHomeworks", () => {
  const finished = (id: string, completedAt: number) => homework(id, [apple], ["apple"], { status: "completed", completedAt });

  it("lists only completed homeworks, newest first", async () => {
    seedHomework(finished("a", 100));
    seedHomework(finished("c", 300));
    seedHomework(finished("b", 200));
    seedHomework(homework("active", [apple], [null]));
    seedHomework(homework("dropped", [apple], [null], { status: "abandoned" }));
    expect((await listCompletedHomeworks(UID)).map((h) => h.id)).toEqual(["c", "b", "a"]);
  });

  it("returns the stored documents", async () => {
    seedHomework(finished("a", 100));
    expect(await listCompletedHomeworks(UID)).toEqual([finished("a", 100)]);
  });

  it("returns 20 by default and honours max", async () => {
    for (let i = 1; i <= 25; i++) seedHomework(finished(`hw${i}`, i));
    const defaults = await listCompletedHomeworks(UID);
    expect(defaults).toHaveLength(20);
    expect(defaults[0].id).toBe("hw25");
    expect((await listCompletedHomeworks(UID, 3)).map((h) => h.id)).toEqual(["hw25", "hw24", "hw23"]);
  });

  it("returns an empty list when there is nothing", async () => {
    expect(await listCompletedHomeworks(UID)).toEqual([]);
  });
});

describe("isolation between users", () => {
  it("keeps each user's state and homeworks separate", async () => {
    await createHomework("alice", homework("hw1", [apple], ["apple"]));
    await createHomework("bob", homework("hw1", [apple], ["nope"]));
    await completeHomework("alice", "hw1", 9_000);

    expect(await getActiveHomework("alice")).toBeNull();
    expect((await getActiveHomework("bob"))?.status).toBe("active");
    expect(stateOf("alice").words.apple).toEqual({ missCount: 0, learnedAt: 9_000 });
    expect(stateOf("bob").words).toEqual({});
    expect(await listCompletedHomeworks("bob")).toEqual([]);
    expect(await loadPracticeState("carol")).toEqual(EMPTY_PRACTICE_STATE);
  });
});

describe("word keys with special characters", () => {
  const keys = ["a.m.", "don't", "look forward to"];
  const words = keys.map((key) => word(key));

  it("stores and reads them back as plain map keys", async () => {
    await createHomework(UID, homework("hw1", words, ["a.m.", "wrong", "look forward to"]));
    await completeHomework(UID, "hw1", 9_000);
    expect(Object.keys(stateOf().words).sort()).toEqual([...keys].sort());
    expect(await loadPracticeState(UID)).toMatchObject({
      words: {
        "a.m.": { missCount: 0, learnedAt: 9_000 },
        "don't": { missCount: 1, lastMissedAt: 9_000 },
        "look forward to": { missCount: 0, learnedAt: 9_000 },
      },
    });
  });

  it("updates an existing entry under such a key", async () => {
    await createHomework(UID, homework("hw1", words, ["x", "x", "x"]));
    await completeHomework(UID, "hw1", 1_000);
    await createHomework(UID, homework("hw2", words, ["a.m.", "x", "x"]));
    await completeHomework(UID, "hw2", 2_000);
    expect(stateOf().words).toEqual({
      "a.m.": { missCount: 1, lastMissedAt: 1_000, learnedAt: 2_000 },
      "don't": { missCount: 2, lastMissedAt: 2_000 },
      "look forward to": { missCount: 2, lastMissedAt: 2_000 },
    });
  });

  it("merges estimates under such keys without turning dots into paths", async () => {
    await saveCefrEstimates(UID, { "a.m.": "A1" });
    await saveCefrEstimates(UID, { "don't": "A2" });
    expect(stateOf().cefrEstimates).toEqual({ "a.m.": "A1", "don't": "A2" });
  });

  it("does not mistake object prototype names for existing entries", async () => {
    const ctor = word("constructor");
    await createHomework(UID, homework("hw1", [ctor], ["wrong"]));
    await completeHomework(UID, "hw1", 9_000);
    expect(Object.entries(stateOf().words)).toEqual([["constructor", { missCount: 1, lastMissedAt: 9_000 }]]);
  });
});
