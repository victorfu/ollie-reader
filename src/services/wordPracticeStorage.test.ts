import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CefrLevel, DictationItem, Homework, HomeworkWord, LegacyHomework } from "../types/wordPractice";

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
  abandonHomework,
  completeHomework,
  createHomework,
  getActiveHomework,
  listCompletedHomeworks,
  loadPracticeState,
  newHomeworkId,
  normalizeSettings,
  saveHomeworkProgress,
  saveHomeworkReview,
  saveSettings,
} from "./wordPracticeStorage";

const NOW = 1_700_000_000_000;
/** Start of the local day `days` after NOW: review dates snap to local days. */
const dayStart = (days: number) => {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
};
const seed = (path: string, data: unknown) => m.docs.set(path, data as Data);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stored = (path: string): any => m.docs.get(path);
const STATE = "users/u/wordPractice/state";
const hwPath = (id: string) => `users/u/wordHomeworks/${id}`;

const word = (text: string, extra: Partial<HomeworkWord> = {}): HomeworkWord => ({
  key: text,
  vocabularyId: `v-${text}`,
  word: text,
  definitions: [{ partOfSpeech: "noun", definition: `meaning of ${text}` }],
  sentence: null,
  cefr: { level: "A1", source: "list" },
  ...extra,
});
const apple = word("apple", { sentence: "I ate an apple." });
const river = word("river", { sentence: "The river is wide." });
const cat = word("cat");

const answered = (key: string, answer: string, source: "new" | "review" = "new"): DictationItem => ({ key, source, answer, skipped: false });
const skipped = (key: string, source: "new" | "review" = "new"): DictationItem => ({ key, source, answer: null, skipped: true });
const unanswered = (key: string): DictationItem => ({ key, source: "new", answer: null, skipped: false });

const hw = (id: string, newWords: HomeworkWord[], dictation: DictationItem[], extra: Partial<Homework> = {}): Homework => ({
  version: 2,
  id,
  status: "active",
  createdAt: 1_000,
  newWords,
  reviewWords: [],
  pages: newWords.map(() => ({ section: "done", copies: 3, phrase: "a phrase here", sentence: "A full sentence here." })),
  dictation,
  corrections: {},
  ...extra,
});
const seedHw = (h: Homework) => seed(hwPath(h.id), h);
const v2State = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  activeHomeworkId: null,
  words: {},
  cefrEstimates: {},
  settings: { newWordCount: 5, reviewLimit: 10, startLevel: "A1" },
  ...extra,
});

beforeEach(() => {
  m.docs.clear();
  m.tail = Promise.resolve();
  m.autoId = 0;
});

describe("loadPracticeState", () => {
  it("converts a legacy state once and marks it schemaVersion 2", async () => {
    seed("users/u/wordPractice/state", { words: { apple: { learnedAt: 5, missCount: 0 }, rivr: { missCount: 1 } }, cefrEstimates: { "look up": "A2" } });
    const state = await loadPracticeState("u", NOW);
    expect(state.words.apple).toMatchObject({ stage: 1, dueAt: NOW });
    expect(state.words.rivr).toMatchObject({ stage: 0, needsPractice: true });
    expect(state.cefrEstimates).toEqual({ "look up": "A2" });
    expect(stored("users/u/wordPractice/state")).toMatchObject({ schemaVersion: 2 });
    await loadPracticeState("u", NOW + 1000);
    expect(stored("users/u/wordPractice/state").words.apple.dueAt).toBe(NOW); // not converted twice
  });

  it("abandons an active legacy homework while converting", async () => {
    seed("users/u/wordPractice/state", { activeHomeworkId: "old", words: {} });
    seed("users/u/wordHomeworks/old", { status: "active", createdAt: 1, words: [], progress: [] });
    const state = await loadPracticeState("u", NOW);
    expect(state.activeHomeworkId).toBeNull();
    expect(stored("users/u/wordHomeworks/old").status).toBe("abandoned");
  });

  it("keeps an active v2 homework pointer when converting", async () => {
    seed("users/u/wordPractice/state", { activeHomeworkId: "new", words: {} });
    seed("users/u/wordHomeworks/new", { version: 2, status: "active", createdAt: 1 });
    const state = await loadPracticeState("u", NOW);
    expect(state.activeHomeworkId).toBe("new");
    expect(stored("users/u/wordHomeworks/new").status).toBe("active");
  });

  it("creates a v2 state when no document exists", async () => {
    expect(await loadPracticeState("u", NOW)).toEqual({
      schemaVersion: 2,
      activeHomeworkId: null,
      words: {},
      cefrEstimates: {},
      settings: { newWordCount: 5, reviewLimit: 10, startLevel: "A1" },
    });
  });

  it("uses default settings when none are stored", async () => {
    expect((await loadPracticeState("u", NOW)).settings).toEqual({ newWordCount: 5, reviewLimit: 10, startLevel: "A1" });
  });

  it("reads a v2 state as it is, repairing malformed parts", async () => {
    seed("users/u/wordPractice/state", {
      schemaVersion: 2,
      activeHomeworkId: 42,
      words: {
        good: { stage: 3, dueAt: 9, missCount: 1, lastResult: "correct", sentence: "A good day." },
        badStage: { stage: 9, missCount: 0 },
        fractional: { stage: 2.5, missCount: 0 },
        junk: "x",
      },
      cefrEstimates: { a: "A1", b: "Z9" },
      settings: { newWordCount: 4, reviewLimit: 99, startLevel: "B1" },
    });
    const state = await loadPracticeState("u", NOW);
    expect(state.activeHomeworkId).toBeNull();
    expect(state.words.good).toEqual({ stage: 3, dueAt: 9, missCount: 1, lastResult: "correct", sentence: "A good day." });
    expect(state.words.badStage.stage).toBe(0);
    expect(state.words.fractional.stage).toBe(0);
    expect(state.words).not.toHaveProperty("junk");
    expect(state.cefrEstimates).toEqual({ a: "A1" });
    expect(state.settings).toEqual({ newWordCount: 4, reviewLimit: 20, startLevel: "B1" });
  });
});

describe("normalizeSettings", () => {
  it("clamps settings into their ranges", () => {
    expect(normalizeSettings({ newWordCount: 50, reviewLimit: -3, startLevel: "Z9" }))
      .toEqual({ newWordCount: 10, reviewLimit: 0, startLevel: "A1" });
    expect(normalizeSettings({ newWordCount: 1, reviewLimit: 7.6, startLevel: "C2" }))
      .toEqual({ newWordCount: 3, reviewLimit: 8, startLevel: "C2" });
  });

  it("uses defaults for non-objects and non-numbers", () => {
    expect(normalizeSettings(null)).toEqual({ newWordCount: 5, reviewLimit: 10, startLevel: "A1" });
    expect(normalizeSettings({ newWordCount: "x", reviewLimit: NaN })).toEqual({ newWordCount: 5, reviewLimit: 10, startLevel: "A1" });
  });
});

describe("saveSettings", () => {
  it("saves settings without touching the words", async () => {
    seed("users/u/wordPractice/state", { schemaVersion: 2, words: { apple: { stage: 2, dueAt: 5, missCount: 0 } } });
    await saveSettings("u", { newWordCount: 3, reviewLimit: 20, startLevel: "B1" });
    expect(stored("users/u/wordPractice/state").settings).toEqual({ newWordCount: 3, reviewLimit: 20, startLevel: "B1" });
    expect(stored("users/u/wordPractice/state").words.apple).toEqual({ stage: 2, dueAt: 5, missCount: 0 });
  });

  it("creates the state when none exists and clamps the values", async () => {
    await saveSettings("u", { newWordCount: 99, reviewLimit: 5, startLevel: "Q" as CefrLevel });
    expect(stored("users/u/wordPractice/state")).toMatchObject({
      schemaVersion: 2,
      settings: { newWordCount: 10, reviewLimit: 5, startLevel: "A1" },
    });
  });
});


describe("newHomeworkId", () => {
  it("returns a fresh non-empty id on every call", () => {
    const a = newHomeworkId("u");
    expect(a).toBeTruthy();
    expect(a).not.toBe(newHomeworkId("u"));
  });
});

describe("createHomework and getActiveHomework", () => {
  it("stores the homework as active and points the state at it", async () => {
    const h = hw("h1", [apple], [unanswered("apple")]);
    await createHomework("u", h);
    expect(stored(hwPath("h1"))).toEqual(h);
    expect(stored(STATE).activeHomeworkId).toBe("h1");
    expect(await getActiveHomework("u")).toEqual(h);
  });

  it("abandons the previous active homework and keeps the word state", async () => {
    seed(STATE, v2State({ words: { apple: { stage: 2, dueAt: 5, missCount: 0 } } }));
    await createHomework("u", hw("h1", [apple], []));
    await createHomework("u", hw("h2", [river], []));
    expect(stored(hwPath("h1")).status).toBe("abandoned");
    expect(stored(STATE)).toMatchObject({ activeHomeworkId: "h2", words: { apple: { stage: 2, dueAt: 5, missCount: 0 } } });
    expect((await getActiveHomework("u"))?.id).toBe("h2");
  });

  it("leaves a finished previous homework alone", async () => {
    const done = hw("old", [apple], [], { status: "completed", completedAt: 5 });
    seedHw(done);
    seed(STATE, v2State({ activeHomeworkId: "old" }));
    await createHomework("u", hw("h2", [river], []));
    expect(stored(hwPath("old"))).toEqual(done);
  });

  it("keeps exactly one active homework when two are created at once", async () => {
    await Promise.all([createHomework("u", hw("a", [apple], [])), createHomework("u", hw("b", [river], []))]);
    const statuses = [stored(hwPath("a")).status, stored(hwPath("b")).status].sort();
    expect(statuses).toEqual(["abandoned", "active"]);
    expect((await getActiveHomework("u"))?.id).toBe(stored(STATE).activeHomeworkId);
  });

  it("writes no undefined values for absent optional fields", async () => {
    await expect(createHomework("u", hw("h1", [{ ...apple, emoji: undefined }], [], { completedAt: undefined }))).resolves.toBeUndefined();
    expect(stored(hwPath("h1")).newWords[0]).not.toHaveProperty("emoji");
    expect(stored(hwPath("h1"))).not.toHaveProperty("completedAt");
  });

  it("returns null when there is no state, a dangling pointer, or a finished homework", async () => {
    expect(await getActiveHomework("u")).toBeNull();
    seed(STATE, v2State({ activeHomeworkId: "ghost" }));
    expect(await getActiveHomework("u")).toBeNull();
    seedHw(hw("done", [apple], [], { status: "completed", completedAt: 5 }));
    seed(STATE, v2State({ activeHomeworkId: "done" }));
    expect(await getActiveHomework("u")).toBeNull();
  });

  it("ignores an active legacy homework when looking for the active one", async () => {
    seed(STATE, v2State({ activeHomeworkId: "legacy" }));
    seed(hwPath("legacy"), { status: "active", createdAt: 1, words: [], progress: [] });
    expect(await getActiveHomework("u")).toBeNull();
  });
});

describe("saveHomeworkProgress", () => {
  it("replaces pages, dictation and corrections and nothing else", async () => {
    const h = hw("h1", [apple, river], [unanswered("apple")]);
    seedHw(h);
    const progress = {
      pages: [{ section: "copy" as const, copies: 1, phrase: null, sentence: null }, h.pages[1]],
      dictation: [answered("apple", "aple"), skipped("river")],
      corrections: { "look up": 2 },
    };
    await saveHomeworkProgress("u", "h1", progress);
    expect(stored(hwPath("h1"))).toEqual({ ...h, ...progress });
  });

  it("writes no undefined values", async () => {
    seedHw(hw("h1", [apple], []));
    const pages = [{ section: "look" as const, copies: 0, phrase: undefined, sentence: null }] as unknown as Homework["pages"];
    await expect(saveHomeworkProgress("u", "h1", { pages, dictation: [], corrections: {} })).resolves.toBeUndefined();
    expect(stored(hwPath("h1")).pages[0]).not.toHaveProperty("phrase");
  });

  it.each(["completed", "abandoned"] as const)("leaves a %s homework untouched", async (status) => {
    const h = hw("h1", [apple], [answered("apple", "apple")], { status, completedAt: 5 });
    seedHw(h);
    await expect(
      saveHomeworkProgress("u", "h1", { pages: h.pages, dictation: [answered("apple", "aple")], corrections: { apple: 1 } }),
    ).resolves.toBeUndefined();
    expect(stored(hwPath("h1"))).toEqual(h);
  });

  it("does not create a homework that does not exist", async () => {
    await expect(saveHomeworkProgress("u", "ghost", { pages: [], dictation: [], corrections: {} })).rejects.toThrow();
    expect(stored(hwPath("ghost"))).toBeUndefined();
  });
});

describe("saveHomeworkReview", () => {
  const review = {
    reviewedAt: NOW,
    items: [{ key: "apple", ok: false, comment: "要加 an。", corrected: "I ate an apple." }],
  };

  it("adds the review to a completed homework without touching anything else", async () => {
    const done = hw("h1", [apple], [answered("apple", "apple")], { status: "completed", completedAt: NOW });
    seedHw(done);
    await saveHomeworkReview("u", "h1", review);
    expect(stored(hwPath("h1"))).toEqual({ ...done, review });
  });

  it("refuses a homework that is missing", async () => {
    await expect(saveHomeworkReview("u", "nope", review)).rejects.toThrow();
  });
});

describe("completeHomework", () => {
  const seedRun = (h: Homework, state: Record<string, unknown> = {}) => {
    seedHw(h);
    seed(STATE, v2State({ activeHomeworkId: h.id, ...state }));
  };
  const wrongRiver = hw("h1", [apple, river], [answered("apple", "Apple"), answered("river", "rivr")], { corrections: { river: 3 } });

  it("completes a homework and schedules every dictated word in one transaction", async () => {
    seedRun(wrongRiver);
    const { homework, reviewUpdates } = await completeHomework("u", "h1", NOW);
    expect(homework).toMatchObject({ status: "completed", completedAt: NOW, result: { correctKeys: ["apple"], wrongKeys: ["river"] } });
    expect(stored(hwPath("h1"))).toEqual(homework);
    expect(stored(STATE).words.apple).toMatchObject({ stage: 1, dueAt: dayStart(1), sentence: "I ate an apple." });
    expect(stored(STATE).words.river).toMatchObject({ stage: 0, needsPractice: true });
    expect(stored(STATE).words.river).not.toHaveProperty("sentence");
    expect(stored(STATE).activeHomeworkId).toBeNull();
    expect(reviewUpdates).toEqual([{ vocabularyId: "v-apple", remembered: true }, { vocabularyId: "v-river", remembered: false }]);
  });

  it("orders review updates like the dictation and covers review words", async () => {
    const h = hw("h1", [apple], [answered("apple", "apple"), answered("river", "river", "review")], { reviewWords: [river] });
    seedRun(h, { words: { river: { stage: 2, dueAt: 1, missCount: 0 } } });
    const { reviewUpdates } = await completeHomework("u", "h1", NOW);
    expect(reviewUpdates.map((u) => u.vocabularyId)).toEqual(["v-apple", "v-river"]);
    expect(stored(STATE).words.river).toMatchObject({ stage: 3, dueAt: dayStart(7) });
  });

  it("changes no schedule and returns no updates when every item was skipped", async () => {
    const wordsBefore = { apple: { stage: 2, dueAt: 5, missCount: 0 } };
    seedRun(hw("h1", [apple, river], [skipped("apple"), skipped("river")]), { words: wordsBefore });
    const { homework, reviewUpdates } = await completeHomework("u", "h1", NOW);
    expect(reviewUpdates).toEqual([]);
    expect(homework.status).toBe("completed");
    expect(stored(STATE).words).toEqual(wordsBefore);
  });

  it("leaves skipped items out of the updates", async () => {
    seedRun(hw("h1", [apple, river], [answered("apple", "apple"), skipped("river")]));
    const { reviewUpdates } = await completeHomework("u", "h1", NOW);
    expect(reviewUpdates).toEqual([{ vocabularyId: "v-apple", remembered: true }]);
    expect(stored(STATE).words).not.toHaveProperty("river");
  });

  it("returns an already completed homework unchanged, with no updates, when completed twice", async () => {
    seedRun(wrongRiver);
    const first = await completeHomework("u", "h1", NOW);
    const stateAfter = structuredClone(stored(STATE));
    const second = await completeHomework("u", "h1", NOW + 99);
    expect(second.homework).toEqual(first.homework);
    expect(second.reviewUpdates).toEqual([]);
    expect(stored(STATE)).toEqual(stateAfter);
  });

  it("counts a word once when two calls race", async () => {
    seedRun(hw("h1", [river], [answered("river", "rivr")], { corrections: { river: 3 } }));
    const [a, b] = await Promise.all([completeHomework("u", "h1", NOW), completeHomework("u", "h1", NOW + 1)]);
    expect([a.reviewUpdates.length, b.reviewUpdates.length].sort()).toEqual([0, 1]);
    expect(stored(STATE).words.river.missCount).toBe(1);
  });

  it("refuses to complete a homework that still has unanswered or uncorrected items", async () => {
    seedRun(hw("unfinished", [apple, river], [answered("apple", "apple"), unanswered("river")]));
    seedHw(hw("uncorrected", [river], [answered("river", "rivr")], { corrections: { river: 1 } }));
    const before = structuredClone([...m.docs.entries()]);
    await expect(completeHomework("u", "unfinished", NOW)).rejects.toThrow();
    await expect(completeHomework("u", "uncorrected", NOW)).rejects.toThrow();
    expect([...m.docs.entries()]).toEqual(before);
  });

  it("rejects an abandoned, a missing and a legacy homework", async () => {
    seedHw(hw("gone", [apple], [answered("apple", "apple")], { status: "abandoned" }));
    seed(hwPath("legacy"), { status: "active", createdAt: 1, words: [], progress: [] });
    await expect(completeHomework("u", "gone", NOW)).rejects.toThrow();
    await expect(completeHomework("u", "ghost", NOW)).rejects.toThrow();
    await expect(completeHomework("u", "legacy", NOW)).rejects.toThrow();
  });

  it("leaves activeHomeworkId alone when it points at another homework", async () => {
    seedHw(hw("old", [apple], [answered("apple", "apple")]));
    seed(STATE, v2State({ activeHomeworkId: "newer" }));
    await completeHomework("u", "old", NOW);
    expect(stored(STATE).activeHomeworkId).toBe("newer");
  });

  it("converts a legacy state while completing", async () => {
    seedHw(hw("h1", [apple], [answered("apple", "apple")]));
    seed(STATE, { activeHomeworkId: "h1", words: { cat: { learnedAt: 5, missCount: 0 } }, cefrEstimates: { x: "A2" } });
    await completeHomework("u", "h1", NOW);
    expect(stored(STATE)).toMatchObject({ schemaVersion: 2, activeHomeworkId: null, cefrEstimates: { x: "A2" } });
    expect(stored(STATE).words.cat).toMatchObject({ stage: 1 });
    expect(stored(STATE).words.apple).toMatchObject({ stage: 1 });
  });

  it("handles keys with dots and object prototype names", async () => {
    const h = hw("h1", [word("a.m."), word("constructor"), cat], [answered("a.m.", "a.m."), answered("constructor", "x"), answered("cat", "cat")], { corrections: { constructor: 3 } });
    seedRun(h);
    await completeHomework("u", "h1", NOW);
    expect(Object.keys(stored(STATE).words).sort()).toEqual(["a.m.", "cat", "constructor"]);
    expect(stored(STATE).words.constructor).toMatchObject({ stage: 0, missCount: 1 });
    expect(stored(STATE).words["a.m."]).toMatchObject({ stage: 1 });
  });

  it("keeps each user's data separate", async () => {
    seed("users/a/wordPractice/state", v2State({ activeHomeworkId: "h1" }));
    seed("users/a/wordHomeworks/h1", hw("h1", [apple], [answered("apple", "apple")]));
    seed("users/b/wordPractice/state", v2State({ activeHomeworkId: "h1" }));
    seed("users/b/wordHomeworks/h1", hw("h1", [apple], [answered("apple", "apple")]));
    await completeHomework("a", "h1", NOW);
    expect((await getActiveHomework("b"))?.status).toBe("active");
    expect(stored("users/b/wordPractice/state").words).toEqual({});
  });
});

describe("abandonHomework", () => {
  it("marks the homework abandoned and clears the pointer, keeping words", async () => {
    seed(STATE, v2State({ words: { apple: { stage: 1, dueAt: 5, missCount: 0 } } }));
    await createHomework("u", hw("h1", [apple], []));
    await abandonHomework("u", "h1");
    expect(stored(hwPath("h1")).status).toBe("abandoned");
    expect(stored(STATE)).toMatchObject({ activeHomeworkId: null, words: { apple: { stage: 1, dueAt: 5, missCount: 0 } } });
  });

  it("leaves a newer active pointer in place", async () => {
    seedHw(hw("old", [apple], []));
    seed(STATE, v2State({ activeHomeworkId: "newer" }));
    await abandonHomework("u", "old");
    expect(stored(hwPath("old")).status).toBe("abandoned");
    expect(stored(STATE).activeHomeworkId).toBe("newer");
  });

  it("is a no-op for a homework that is not active", async () => {
    seedHw(hw("h1", [apple], [], { status: "completed", completedAt: 1 }));
    seed(STATE, v2State({ activeHomeworkId: "other" }));
    const before = structuredClone([...m.docs.entries()]);
    await abandonHomework("u", "h1");
    await abandonHomework("u", "ghost");
    expect([...m.docs.entries()]).toEqual(before);
  });
});

describe("listCompletedHomeworks", () => {
  const finished = (id: string, completedAt: number) => hw(id, [apple], [], { status: "completed", completedAt });

  it("lists completed homeworks of both versions, newest first", async () => {
    const legacy: Omit<LegacyHomework, "id"> = { status: "completed", createdAt: 1, completedAt: 100, words: [{ key: "a", word: "a" }], result: { correctCount: 1, total: 1 } };
    seed(hwPath("legacy"), legacy);
    seedHw(finished("v2", 200));
    seedHw(hw("active", [apple], []));
    seedHw(hw("dropped", [apple], [], { status: "abandoned" }));
    const list = await listCompletedHomeworks("u");
    expect(list.map((h) => h.id)).toEqual(["v2", "legacy"]);
    expect(list[1]).toEqual({ ...legacy, id: "legacy" });
  });

  it("returns 20 by default and honours max", async () => {
    for (let i = 1; i <= 25; i++) seedHw(finished(`hw${i}`, i));
    const defaults = await listCompletedHomeworks("u");
    expect(defaults).toHaveLength(20);
    expect(defaults[0].id).toBe("hw25");
    expect((await listCompletedHomeworks("u", 3)).map((h) => h.id)).toEqual(["hw25", "hw24", "hw23"]);
  });

  it("returns an empty list when there is nothing", async () => {
    expect(await listCompletedHomeworks("u")).toEqual([]);
  });
});
