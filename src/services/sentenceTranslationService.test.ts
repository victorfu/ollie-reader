import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db: unknown, _collection: string, id: string) => ({ id })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  where: vi.fn((...args: unknown[]) => ({ kind: "where", args })),
  getDocs: mocks.getDocs,
  getDocsFromServer: mocks.getDocsFromServer,
  getDoc: mocks.getDoc,
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
  orderBy: vi.fn(() => ({ kind: "order" })),
  limit: vi.fn((value: number) => ({ kind: "limit", value })),
  startAfter: vi.fn(),
  writeBatch: vi.fn(),
  runTransaction: mocks.runTransaction,
  updateDoc: mocks.updateDoc,
}));

vi.mock("../utils/firebaseUtil", () => ({ db: {} }));

import { addSentenceTranslation } from "./sentenceTranslationService";

function legacySnapshot(id: string, english: string, userId = "user-1") {
  const data = {
    userId,
    english,
    chinese: "你好，世界",
    createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
  };
  return {
    id,
    ref: { id },
    data: () => data,
  };
}

describe("sentence translation normalized identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateDoc.mockResolvedValue(undefined);
  });

  it("reuses and migrates a normalized-equivalent legacy auto-id record", async () => {
    const legacy = legacySnapshot("legacy-auto-id", "  Hello   WORLD  ");
    mocks.getDocsFromServer.mockResolvedValueOnce({
      docs: [legacy],
      empty: false,
    });

    const result = await addSentenceTranslation({
      userId: "user-1",
      english: "hello world",
      chinese: "哈囉世界",
    });

    expect(result).toEqual({
      id: "legacy-auto-id",
      created: false,
      sentence: expect.objectContaining({
        id: "legacy-auto-id",
        english: "  Hello   WORLD  ",
      }),
    });
    expect(mocks.updateDoc).toHaveBeenCalledWith(legacy.ref, {
      normalizedEnglish: "hello world",
    });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("does not cache an offline partial legacy index and create a duplicate after reconnect", async () => {
    const legacy = legacySnapshot(
      "legacy-after-reconnect",
      "HELLO   world",
      "user-2",
    );
    mocks.getDocsFromServer
      .mockRejectedValueOnce(new Error("server unavailable"))
      .mockResolvedValueOnce({ docs: [legacy], empty: false });

    const input = {
      userId: "user-2",
      english: "hello world",
      chinese: "哈囉世界",
    };

    await expect(addSentenceTranslation(input)).rejects.toThrow(
      "server unavailable",
    );
    await expect(addSentenceTranslation(input)).resolves.toEqual(
      expect.objectContaining({
        id: "legacy-after-reconnect",
        created: false,
      }),
    );

    expect(mocks.getDocsFromServer).toHaveBeenCalledTimes(2);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects a deterministic id occupied by another owner's data", async () => {
    mocks.getDocsFromServer.mockResolvedValueOnce({ docs: [], empty: true });
    mocks.runTransaction.mockImplementation(
      async (
        _db: unknown,
        update: (transaction: {
          get: ReturnType<typeof vi.fn>;
          set: ReturnType<typeof vi.fn>;
        }) => Promise<unknown>,
      ) =>
        update({
          get: vi.fn().mockResolvedValue({
            id: "occupied-id",
            exists: () => true,
            data: () => ({
              userId: "attacker",
              english: "hello world",
              chinese: "不應外洩",
            }),
          }),
          set: vi.fn(),
        }),
    );

    await expect(
      addSentenceTranslation({
        userId: "user-3",
        english: "hello world",
        chinese: "哈囉世界",
      }),
    ).rejects.toThrow("唯一識別碼已被不相符的資料占用");
  });
});
