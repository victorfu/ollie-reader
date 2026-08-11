import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  writeBatch: vi.fn(),
  runTransaction: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));
const timestamp = vi.hoisted(() => ({ kind: "timestamp" }));

vi.mock("firebase/firestore", () => ({
  ...firestoreMocks,
  Timestamp: { now: () => timestamp },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: mockDb }));

import {
  addSentences,
  updateSentenceOrders,
} from "./sentencePracticeService";

function speechSnapshot(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

describe("sentence practice ordering", () => {
  let nextSentenceId: number;
  let batches: Array<{
    set: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
    nextSentenceId = 0;
    batches = [];
    firestoreMocks.collection.mockImplementation((_database, name: string) => ({
      kind: "collection",
      name,
    }));
    firestoreMocks.doc.mockImplementation((parent, ...segments: string[]) => {
      if (parent === mockDb) {
        return { kind: "document", path: segments.join("/") };
      }
      nextSentenceId += 1;
      return {
        id: `new-${nextSentenceId}`,
        kind: "document",
        path: `${parent.name}/new-${nextSentenceId}`,
      };
    });
    firestoreMocks.query.mockImplementation((...parts) => ({ parts }));
    firestoreMocks.where.mockImplementation((...parts) => ({ where: parts }));
    firestoreMocks.orderBy.mockImplementation((...parts) => ({ orderBy: parts }));
    firestoreMocks.limit.mockImplementation((value) => ({ limit: value }));
    firestoreMocks.writeBatch.mockImplementation(() => {
      const batch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      batches.push(batch);
      return batch;
    });
  });

  it("reserves disjoint top-order ranges for concurrent tabs", async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ order: 0 }) }],
    });

    const speechData: Record<string, unknown> = { userId: "user-1" };
    let transactionTail = Promise.resolve<unknown>(undefined);
    firestoreMocks.runTransaction.mockImplementation((_database, callback) => {
      const result = transactionTail.then(() =>
        callback({
          get: vi.fn().mockImplementation(async () =>
            speechSnapshot({ ...speechData }),
          ),
          update: vi.fn().mockImplementation((_reference, updates) => {
            Object.assign(speechData, updates);
          }),
        }),
      );
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });

    const makeSentence = (english: string) => ({
      english,
      chinese: `${english} 中文`,
      userId: "user-1",
      speechId: "speech-1",
      order: 0,
    });
    const [first, second] = await Promise.all([
      addSentences([makeSentence("First")]),
      addSentences([makeSentence("Second")]),
    ]);

    const reservedOrders = [...first, ...second]
      .map((entry) => entry.order)
      .sort((left, right) => left - right);
    expect(reservedOrders).toEqual([-2, -1]);
    expect(new Set(reservedOrders).size).toBe(2);
    expect(speechData.sentenceOrderFloor).toBe(-2);
    expect(batches.flatMap((batch) => batch.set.mock.calls)).toHaveLength(2);
  });

  it("reuses occupied order slots when reordering a loaded 50-row page", async () => {
    const documents = Array.from({ length: 52 }, (_, index) => ({
      id: `sentence-${index}`,
      ref: { kind: "sentence", id: `sentence-${index}` },
      data: () => ({ order: index - 1 }),
    }));
    firestoreMocks.getDocs.mockResolvedValue({ empty: false, docs: documents });
    const loadedIds = documents.slice(0, 50).map((document) => document.id);
    const desiredIds = [...loadedIds].reverse();

    const updates = await updateSentenceOrders("speech-1", desiredIds);
    const orderById = new Map(
      updates.map((update) => [update.id, update.order]),
    );
    const resultingOrders = documents.map(
      (document) => orderById.get(document.id) ?? document.data().order,
    );

    expect(updates).toHaveLength(50);
    expect(new Set(resultingOrders).size).toBe(52);
    expect(orderById.get(desiredIds[0])).toBe(-1);
    expect(orderById.get(desiredIds[49])).toBe(48);
    expect(resultingOrders[50]).toBe(49);
    expect(resultingOrders[51]).toBe(50);
    expect(batches).toHaveLength(1);
    expect(batches[0].update).toHaveBeenCalledTimes(50);
  });

  it("repairs legacy duplicate orders while applying the requested reorder", async () => {
    const documents = Array.from({ length: 52 }, (_, index) => ({
      id: `sentence-${index}`,
      ref: { kind: "sentence", id: `sentence-${index}` },
      data: () => ({ order: index === 50 ? 49 : index }),
    }));
    firestoreMocks.getDocs.mockResolvedValue({ empty: false, docs: documents });
    const desiredIds = documents
      .slice(0, 50)
      .map((document) => document.id)
      .reverse();

    const updates = await updateSentenceOrders("speech-1", desiredIds);

    expect(updates).toHaveLength(52);
    expect(new Set(updates.map((update) => update.order)).size).toBe(52);
    expect(updates.slice(0, 50).map((update) => update.id)).toEqual(desiredIds);
    expect(batches[0].update).toHaveBeenCalledTimes(51);
  });
});
