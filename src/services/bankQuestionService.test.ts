import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeBatch {
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  getDocs: vi.fn(),
  batches: [] as FakeBatch[],
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_parent: unknown, name?: string, id?: string) =>
    name === undefined ? { id: "generated-id" } : { path: `${name}/${id}` },
  ),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: mocks.getDocs,
  writeBatch: vi.fn(() => {
    const batch: FakeBatch = {
      set: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    mocks.batches.push(batch);
    return batch;
  }),
  Timestamp: {
    now: vi.fn(() => ({ kind: "now" })),
    fromDate: vi.fn((date: Date) => ({ kind: "fromDate", date })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));

import { makePage, makeQuestion } from "../testing/questionBankFixtures";
import {
  commitEditorChanges,
  deleteQuestionsForSource,
  listBankQuestions,
  listQuestionsForSource,
  newBankQuestionId,
} from "./bankQuestionService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };

function questionDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ref: { path: `bankQuestions/${id}` },
    data: () => ({
      userId: "user-1",
      sourceId: "s1",
      subject: "math",
      regions: [{ pageIndex: 0, box: { x: 0, y: 0, w: 0.5, h: 0.5 } }],
      answerSpace: "none",
      createdAt: stamp,
      updatedAt: stamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.batches.length = 0;
  mocks.auth.currentUser = { uid: "user-1" };
});

describe("newBankQuestionId", () => {
  it("uses a Firestore auto id", () => {
    expect(newBankQuestionId()).toBe("generated-id");
  });
});

describe("listBankQuestions", () => {
  it("queries the current user's questions and skips broken documents", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [questionDoc("q1"), questionDoc("broken", { regions: [] })],
    });
    const questions = await listBankQuestions();
    expect(questions.map((q) => q.id)).toEqual(["q1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([{ field: "userId", op: "==", value: "user-1" }]);
  });

  it("refuses to run without a signed-in user", async () => {
    mocks.auth.currentUser = null;
    await expect(listBankQuestions()).rejects.toThrow("尚未登入");
  });
});

describe("listQuestionsForSource", () => {
  it("filters by user and source", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [questionDoc("q1")] });
    await listQuestionsForSource("s1");
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { field: "userId", op: "==", value: "user-1" },
      { field: "sourceId", op: "==", value: "s1" },
    ]);
  });
});

describe("deleteQuestionsForSource", () => {
  it("deletes in batches of 500", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: Array.from({ length: 1200 }, (_, index) => questionDoc(`q${index}`)),
    });
    await deleteQuestionsForSource("s1");
    expect(mocks.batches.map((batch) => batch.delete.mock.calls.length)).toEqual([500, 500, 200]);
    expect(mocks.batches.every((batch) => batch.commit.mock.calls.length === 1)).toBe(true);
  });
});

describe("commitEditorChanges", () => {
  it("writes questions, deletions and the source in one batch", async () => {
    const question = makeQuestion({ id: "q1", answer: undefined });
    await commitEditorChanges({
      upserts: [question],
      deleteIds: ["q9"],
      source: { id: "s1", title: "新標題", pages: [makePage()] },
    });

    expect(mocks.batches).toHaveLength(1);
    const [batch] = mocks.batches;
    const [ref, data] = batch.set.mock.calls[0];
    expect(ref).toEqual({ path: "bankQuestions/q1" });
    expect("answer" in data).toBe(false);
    expect(batch.delete).toHaveBeenCalledWith({ path: "bankQuestions/q9" });
    expect(batch.update).toHaveBeenCalledWith(
      { path: "questionSources/s1" },
      expect.objectContaining({ title: "新標題", updatedAt: { kind: "now" } }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("puts the source update in the last batch when chunking", async () => {
    const upserts = Array.from({ length: 501 }, (_, index) => makeQuestion({ id: `q${index}` }));
    await commitEditorChanges({
      upserts,
      deleteIds: [],
      source: { id: "s1", title: "t", pages: [makePage()] },
    });
    expect(mocks.batches).toHaveLength(2);
    expect(mocks.batches[0].update).not.toHaveBeenCalled();
    expect(mocks.batches[1].update).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is nothing to write", async () => {
    await commitEditorChanges({ upserts: [], deleteIds: [], source: null });
    expect(mocks.batches).toHaveLength(0);
  });
});
