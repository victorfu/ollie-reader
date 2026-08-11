import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const getDocs = vi.fn();
  const getDocsFromServer = vi.fn();
  const getDoc = vi.fn();
  const updateDoc = vi.fn();
  let transactionQueue = Promise.resolve();
  const set = vi.fn(
    (reference: { path: string }, data: Record<string, unknown>) => {
      documents.set(reference.path, data);
    },
  );

  return {
    documents,
    getDoc,
    getDocs,
    getDocsFromServer,
    set,
    updateDoc,
    reset() {
      documents.clear();
      set.mockClear();
      getDoc.mockReset();
      getDoc.mockResolvedValue({ exists: () => false });
      getDocs.mockReset();
      getDocs.mockResolvedValue({ docs: [], empty: true });
      getDocsFromServer.mockReset();
      getDocsFromServer.mockResolvedValue({ docs: [], empty: true });
      updateDoc.mockReset();
      updateDoc.mockResolvedValue(undefined);
      transactionQueue = Promise.resolve();
    },
    runTransaction: vi.fn(
      <T,>(
        _db: unknown,
        callback: (transaction: {
          get: (reference: { id: string; path: string }) => Promise<unknown>;
          set: typeof set;
        }) => Promise<T>,
      ) => {
        const result = transactionQueue.then(() =>
          callback({
            get: async (reference) => ({
              id: reference.id,
              exists: () => documents.has(reference.path),
              data: () => documents.get(reference.path),
            }),
            set,
          }),
        );
        transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    ),
  };
});

vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name: string) => ({ path: name })),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db, collectionName: string, id: string) => ({
    id,
    path: `${collectionName}/${id}`,
  })),
  endAt: vi.fn(),
  getCountFromServer: vi.fn(),
  getDoc: firestore.getDoc,
  getDocs: firestore.getDocs,
  getDocsFromServer: firestore.getDocsFromServer,
  increment: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((...parts: unknown[]) => parts),
  runTransaction: firestore.runTransaction,
  startAfter: vi.fn(),
  startAt: vi.fn(),
  Timestamp: {
    now: () => ({ toDate: () => new Date("2026-01-01T00:00:00Z") }),
  },
  updateDoc: firestore.updateDoc,
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

import { addSentenceTranslation } from "./sentenceTranslationService";
import {
  addVocabularyWord,
  checkWordExists,
  searchUserVocabulary,
} from "./vocabularyService";

describe("user-owned text uniqueness", () => {
  beforeEach(() => {
    firestore.reset();
  });

  it("serializes concurrent inserts of the same vocabulary word to one document", async () => {
    const baseWord = {
      userId: "user-1",
      word: "apple",
      definitions: [{ partOfSpeech: "noun", definition: "a fruit" }],
      examples: [],
      synonyms: [],
      antonyms: [],
      tags: [],
    };

    const [first, second] = await Promise.all([
      addVocabularyWord(baseWord),
      addVocabularyWord({ ...baseWord, word: " Apple " }),
    ]);

    expect(first.id).toBe(second.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(firestore.set).toHaveBeenCalledTimes(1);
  });

  it("reuses and migrates a case/whitespace-equivalent legacy vocabulary record", async () => {
    const timestamp = { toDate: () => new Date("2026-01-01T00:00:00Z") };
    const legacy = {
      id: "legacy-auto-id",
      ref: { path: "vocabulary/legacy-auto-id" },
      data: () => ({
        userId: "user-1",
        word: "  Ice   CREAM ",
        definitions: [{ partOfSpeech: "noun", definition: "a dessert" }],
        examples: [],
        synonyms: [],
        antonyms: [],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        reviewCount: 0,
      }),
    };
    firestore.getDocs.mockResolvedValueOnce({ docs: [legacy], empty: false });

    const result = await addVocabularyWord({
      userId: "user-1",
      word: "ice cream",
      definitions: [{ partOfSpeech: "noun", definition: "a dessert" }],
      examples: [],
      synonyms: [],
      antonyms: [],
      tags: [],
    });

    expect(result).toEqual({
      id: "legacy-auto-id",
      created: false,
      word: expect.objectContaining({
        id: "legacy-auto-id",
        word: "  Ice   CREAM ",
      }),
    });
    expect(firestore.updateDoc).toHaveBeenCalledWith(legacy.ref, {
      normalizedWord: "ice cream",
    });
    expect(firestore.set).not.toHaveBeenCalled();
  });

  it("keeps the exact legacy lookup path and backfills its normalized word", async () => {
    const timestamp = { toDate: () => new Date("2026-01-01T00:00:00Z") };
    const legacy = {
      id: "legacy-apple",
      ref: { path: "vocabulary/legacy-apple" },
      data: () => ({
        userId: "user-1",
        word: "apple",
        definitions: [],
        examples: [],
        synonyms: [],
        antonyms: [],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        reviewCount: 0,
      }),
    };
    firestore.getDocs
      .mockResolvedValueOnce({ docs: [], empty: true })
      .mockResolvedValueOnce({ docs: [legacy], empty: false });

    await expect(checkWordExists("user-1", " Apple ")).resolves.toEqual(
      expect.objectContaining({ id: "legacy-apple", word: "apple" }),
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(legacy.ref, {
      normalizedWord: "apple",
    });
  });

  it("serializes concurrent inserts of the same translated sentence", async () => {
    const [first, second] = await Promise.all([
      addSentenceTranslation({
        userId: "user-1",
        english: "How are you?",
        chinese: "你好嗎？",
      }),
      addSentenceTranslation({
        userId: "user-1",
        english: "  HOW   ARE YOU? ",
        chinese: "最近如何？",
      }),
    ]);

    expect(first.id).toBe(second.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(firestore.set).toHaveBeenCalledTimes(1);
    expect(firestore.getDocsFromServer).toHaveBeenCalledTimes(1);
    expect(second.sentence?.chinese).toBe("你好嗎？");
  });

  it("can search every saved word by substring without a page cap", async () => {
    const timestamp = { toDate: () => new Date("2026-01-01T00:00:00Z") };
    firestore.getDocs.mockResolvedValue({
      docs: Array.from({ length: 130 }, (_, index) => ({
        id: `word-${index}`,
        data: () => ({
          userId: "user-1",
          word: index === 129 ? "apple" : `pp-${index}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      })),
    });

    const results = await searchUserVocabulary("user-1", "pp", {
      mode: "contains",
      limit: null,
    });

    expect(results).toHaveLength(130);
    expect(results.some((word) => word.word === "apple")).toBe(true);
  });
});
