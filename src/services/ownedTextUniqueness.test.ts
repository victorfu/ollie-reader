import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const getDocs = vi.fn();
  const getDocsFromServer = vi.fn();
  const getDoc = vi.fn();
  const updateDoc = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn();
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
    batchUpdate,
    batchCommit,
    reset() {
      documents.clear();
      set.mockClear();
      batchUpdate.mockReset();
      batchCommit.mockReset();
      batchCommit.mockResolvedValue(undefined);
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
  limit: vi.fn((count: number) => ({ limit: count })),
  orderBy: vi.fn(),
  query: vi.fn((...parts: unknown[]) => parts),
  runTransaction: firestore.runTransaction,
  startAfter: vi.fn(),
  startAt: vi.fn(),
  Timestamp: {
    now: () => ({ toDate: () => new Date("2026-01-01T00:00:00Z") }),
  },
  updateDoc: firestore.updateDoc,
  where: vi.fn((field: string, op: string, value: unknown) => ({
    where: [field, op, value],
  })),
  writeBatch: vi.fn(() => ({
    update: firestore.batchUpdate,
    commit: firestore.batchCommit,
  })),
}));

import { addSentenceTranslation } from "./sentenceTranslationService";
import {
  addVocabularyWord,
  checkWordExists,
  getVocabularyWord,
  getVocabularyForReview,
  searchUserVocabulary,
} from "./vocabularyService";

const vocabularyEntry = (word: string) => ({
  userId: "user-1",
  word,
  definitions: [{ partOfSpeech: "noun", definition: `meaning of ${word}` }],
  examples: [],
  synonyms: [],
  antonyms: [],
  tags: [],
});

const savedVocabularyDocument = (
  id: string,
  fields: Record<string, unknown>,
) => {
  const timestamp = { toDate: () => new Date("2026-01-01T00:00:00Z") };
  return {
    id,
    ref: { path: `vocabulary/${id}` },
    data: () => ({
      userId: "user-1",
      definitions: [],
      examples: [],
      synonyms: [],
      antonyms: [],
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      reviewCount: 0,
      ...fields,
    }),
  };
};

describe("user-owned text uniqueness", () => {
  beforeEach(() => {
    firestore.reset();
    window.localStorage.clear();
  });

  it("uses saved recall history to prioritize forgotten words", async () => {
    const lastReviewedAt = { toDate: () => new Date("2026-01-01") };
    firestore.getDocs.mockResolvedValue({ docs: [
      { id: "remembered", data: () => ({ word: "easy", lastReviewedAt, rememberedCount: 10 }) },
      { id: "forgotten", data: () => ({ word: "hard", lastReviewedAt, forgotCount: 10 }) },
    ] });
    const words = await getVocabularyForReview("user-1", 1);
    expect(words.map(word => word.id)).toEqual(["forgotten"]);
    expect(words[0].forgotCount).toBe(10);
    expect(words[0].rememberedCount).toBe(0);
  });

  it("defaults legacy recall counters to zero", async () => {
    firestore.getDocs.mockResolvedValue({ docs: [
      { id: "legacy", data: () => ({ word: "old" }) },
    ] });
    expect(await getVocabularyForReview("user-1", 1)).toMatchObject([
      { id: "legacy", rememberedCount: 0, forgotCount: 0 },
    ]);
  });

  it("recovers previously saved examples without requiring regeneration or a database write", async () => {
    firestore.getDoc.mockResolvedValue({
      id: "saved-tummy",
      exists: () => true,
      data: () => ({
        word: "tummy", userId: "user-1",
        examples: ["My tummy hurts.", { english: "Rub your tummy." }, {}],
      }),
    });

    expect((await getVocabularyWord("saved-tummy"))?.examples).toEqual([
      { sentence: "My tummy hurts." },
      { sentence: "Rub your tummy." },
    ]);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
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
    // Both first-time adds share one account scan.
    expect(firestore.getDocsFromServer).toHaveBeenCalledTimes(1);
  });

  it("reuses and migrates a case/whitespace-equivalent legacy vocabulary record", async () => {
    const legacy = savedVocabularyDocument("legacy-auto-id", {
      word: "  Ice   CREAM ",
      reviewCount: 4,
      rememberedCount: 3,
      forgotCount: 1,
    });
    firestore.getDocsFromServer.mockResolvedValueOnce({
      docs: [legacy],
      empty: false,
    });

    const result = await addVocabularyWord(vocabularyEntry("ice cream"));

    expect(result).toEqual({
      id: "legacy-auto-id",
      created: false,
      word: expect.objectContaining({
        id: "legacy-auto-id",
        word: "  Ice   CREAM ",
        reviewCount: 4,
        rememberedCount: 3,
        forgotCount: 1,
      }),
    });
    expect(firestore.batchUpdate).toHaveBeenCalledWith(legacy.ref, {
      normalizedWord: "ice cream",
    });
    expect(firestore.set).not.toHaveBeenCalled();
  });

  it("backfills only the normalized word of legacy records on the first add", async () => {
    const legacyIceCream = savedVocabularyDocument("legacy-ice", {
      word: "  Ice   CREAM ",
      reviewCount: 7,
    });
    const legacyApple = savedVocabularyDocument("legacy-apple", {
      word: "apple",
    });
    const alreadyNormalized = savedVocabularyDocument("v1_pear", {
      word: "pear",
      normalizedWord: "pear",
    });
    const blank = savedVocabularyDocument("legacy-blank", { word: "   " });
    firestore.getDocsFromServer.mockResolvedValueOnce({
      docs: [legacyIceCream, legacyApple, alreadyNormalized, blank],
      empty: false,
    });

    const result = await addVocabularyWord(vocabularyEntry("river"));

    expect(result.created).toBe(true);
    expect(firestore.batchUpdate.mock.calls).toEqual([
      [legacyIceCream.ref, { normalizedWord: "ice cream" }],
      [legacyApple.ref, { normalizedWord: "apple" }],
    ]);
    expect(firestore.batchCommit).toHaveBeenCalledTimes(1);
  });

  it("adds without rescanning the account once its records are backfilled", async () => {
    await addVocabularyWord(vocabularyEntry("river"));
    firestore.getDocsFromServer.mockClear();
    firestore.getDocs.mockClear();
    firestore.getDocs.mockResolvedValue({ docs: [], empty: true });

    const result = await addVocabularyWord(vocabularyEntry("lake"));

    expect(result.created).toBe(true);
    expect(firestore.getDocsFromServer).not.toHaveBeenCalled();
    // A single one-document query; the transaction then reads the new id.
    expect(firestore.getDocs).toHaveBeenCalledTimes(1);
    expect(firestore.getDocs.mock.calls[0][0]).toContainEqual({ limit: 1 });
  });

  it("finds a backfilled legacy record by its normalized word without a scan", async () => {
    await addVocabularyWord(vocabularyEntry("river"));
    firestore.getDocsFromServer.mockClear();
    firestore.set.mockClear();
    const legacy = savedVocabularyDocument("legacy-ice", {
      word: "Ice  Cream",
      normalizedWord: "ice cream",
    });
    firestore.getDocs.mockResolvedValueOnce({ docs: [legacy], empty: false });

    const result = await addVocabularyWord(vocabularyEntry("ice cream"));

    expect(result).toEqual({
      id: "legacy-ice",
      created: false,
      word: expect.objectContaining({ id: "legacy-ice", word: "Ice  Cream" }),
    });
    expect(firestore.getDocsFromServer).not.toHaveBeenCalled();
    expect(firestore.getDocs).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        { where: ["normalizedWord", "==", "ice cream"] },
        { limit: 1 },
      ]),
    );
    expect(firestore.set).not.toHaveBeenCalled();
  });

  it("splits a large backfill into batches Firestore accepts", async () => {
    firestore.getDocsFromServer.mockResolvedValueOnce({
      docs: Array.from({ length: 501 }, (_, index) =>
        savedVocabularyDocument(`legacy-${index}`, { word: `word ${index}` }),
      ),
      empty: false,
    });

    await addVocabularyWord(vocabularyEntry("river"));

    expect(firestore.batchUpdate).toHaveBeenCalledTimes(501);
    expect(firestore.batchCommit).toHaveBeenCalledTimes(2);
  });

  it("still reuses the legacy record and rescans next time when the backfill fails", async () => {
    const legacy = savedVocabularyDocument("legacy-ice", {
      word: "Ice Cream",
    });
    firestore.getDocsFromServer.mockResolvedValue({
      docs: [legacy],
      empty: false,
    });
    firestore.batchCommit.mockRejectedValueOnce(new Error("Quota exceeded."));

    const result = await addVocabularyWord(vocabularyEntry("ice cream"));

    expect(result).toMatchObject({ id: "legacy-ice", created: false });
    expect(firestore.set).not.toHaveBeenCalled();

    await addVocabularyWord(vocabularyEntry("river"));
    expect(firestore.getDocsFromServer).toHaveBeenCalledTimes(2);
  });

  it("does not create a word when the account scan fails", async () => {
    firestore.getDocsFromServer.mockRejectedValueOnce(
      new Error("Quota exceeded."),
    );

    await expect(
      addVocabularyWord(vocabularyEntry("river")),
    ).rejects.toThrow("Quota exceeded.");
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
