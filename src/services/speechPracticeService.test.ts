import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => ({ kind: "delete-field" })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ kind: "limit", value })),
  orderBy: vi.fn(),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({
    base,
    constraints,
  })),
  startAfter: vi.fn((value: unknown) => ({ kind: "startAfter", value })),
  runTransaction: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  deletePracticeAudio: vi.fn(),
}));

const cleanupMocks = vi.hoisted(() => ({
  enqueuePracticeAudioCleanup: vi.fn(),
  readPracticeAudioCleanupQueue: vi.fn(),
  removePracticeAudioCleanup: vi.fn(),
  runWithPracticeAudioOperationLock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  ...firestoreMocks,
  Timestamp: { now: vi.fn(() => ({ kind: "timestamp" })) },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: { kind: "db" } }));
vi.mock("./audioStorageService", () => ({
  deletePracticeAudio: storageMocks.deletePracticeAudio,
}));
vi.mock("./practiceAudioCleanupQueue", () => ({
  enqueuePracticeAudioCleanup: cleanupMocks.enqueuePracticeAudioCleanup,
  readPracticeAudioCleanupQueue: cleanupMocks.readPracticeAudioCleanupQueue,
  removePracticeAudioCleanup: cleanupMocks.removePracticeAudioCleanup,
  runWithPracticeAudioOperationLock:
    cleanupMocks.runWithPracticeAudioOperationLock,
}));

import {
  beginPracticeAudioUpload,
  completePracticeAudioUpload,
  deletePracticeRecord,
  getPracticeAudioReferenceStatus,
  getPracticeCountByTopic,
  getUserPracticeRecords,
  resolvePracticeAudioCleanup,
} from "./speechPracticeService";

function mockTransaction(data: Record<string, unknown> | null) {
  const update = vi.fn();
  firestoreMocks.runTransaction.mockImplementationOnce(
    async (_db: unknown, callback: (transaction: unknown) => unknown) => (
      callback({
        get: vi.fn().mockResolvedValue({
          exists: () => data !== null,
          data: () => data,
        }),
        update,
      })
    ),
  );
  return update;
}

function mockMutableTransactions(
  initialData: Record<string, unknown> | null,
  options: { rejectDeleteAck?: boolean; rejectDeleteBeforeCommit?: boolean } = {},
) {
  let data = initialData;
  const update = vi.fn((_ref: unknown, patch: Record<string, unknown>) => {
    data = data ? { ...data, ...patch } : data;
  });
  const deleteRecord = vi.fn(() => {
    data = null;
  });
  firestoreMocks.runTransaction.mockImplementation(
    async (_db: unknown, callback: (transaction: unknown) => unknown) => {
      let deletedInThisAttempt = false;
      const result = await callback({
        get: vi.fn().mockImplementation(async () => ({
          exists: () => data !== null,
          data: () => data,
        })),
        update,
        delete: vi.fn(() => {
          deletedInThisAttempt = true;
          if (!options.rejectDeleteBeforeCommit) deleteRecord();
        }),
      });
      if (deletedInThisAttempt && options.rejectDeleteBeforeCommit) {
        throw new Error("permission");
      }
      if (deletedInThisAttempt && options.rejectDeleteAck) {
        throw new Error("lost ACK");
      }
      return result;
    },
  );
  return { update, deleteRecord, data: () => data };
}

function practiceDoc(index: number, topicId = "topic-a") {
  return {
    id: `record-${index}`,
    data: () => ({
      topicId,
      topicTitle: topicId,
      userId: "user-1",
      durationSeconds: 30,
      createdAt: { toDate: () => new Date(2026, 0, 1, 0, 0, index) },
    }),
  };
}

function querySnapshot(docs: ReturnType<typeof practiceDoc>[]) {
  return { docs, empty: docs.length === 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.collection.mockReturnValue({ kind: "collection" });
  firestoreMocks.doc.mockImplementation((_db, collectionName, id) => ({
    collectionName,
    id,
  }));
  firestoreMocks.getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ userId: "user-1" }),
  });
  firestoreMocks.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => ({ userId: "user-1" }),
  });
  firestoreMocks.deleteDoc.mockResolvedValue(undefined);
  storageMocks.deletePracticeAudio.mockResolvedValue(undefined);
  cleanupMocks.enqueuePracticeAudioCleanup.mockReturnValue(true);
  cleanupMocks.readPracticeAudioCleanupQueue.mockReturnValue([]);
  cleanupMocks.removePracticeAudioCleanup.mockReturnValue(true);
  cleanupMocks.runWithPracticeAudioOperationLock.mockImplementation(
    async (_cleanup: unknown, work: (usedWebLock: boolean) => Promise<unknown>) => ({
      acquired: true,
      usedWebLock: true,
      value: await work(true),
    }),
  );
});

describe("speech practice audio metadata verification", () => {
  it("recognizes a server-committed recording path after a lost ACK", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        userId: "user-1",
        recordingUrl: "speech-practice/user-1/record-1.mp4",
      }),
    });

    await expect(getPracticeAudioReferenceStatus(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.mp4",
    )).resolves.toBe("referenced");
  });

  it("reports only an owner-verified different path as unreferenced", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        userId: "user-1",
        recordingUrl: "speech-practice/user-1/record-1.webm",
      }),
    });

    await expect(getPracticeAudioReferenceStatus(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.mp4",
    )).resolves.toBe("unreferenced");
  });

  it("treats an ownership mismatch as ambiguous instead of deletable", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ userId: "user-2" }),
    });

    await expect(getPracticeAudioReferenceStatus(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.mp4",
    )).rejects.toThrow("ownership could not be verified");
  });
});

describe("speech practice audio operation tokens", () => {
  const path = "speech-practice/user-1/record-1.mp4";
  const marker = {
    userId: "user-1",
    recordId: "record-1",
    path,
    reason: "orphaned-upload" as const,
    operationId: "upload-op-1",
    leaseExpiresAt: 0,
  };

  it("refuses a begin whose exact token was cancelled before it arrived", async () => {
    const update = mockTransaction({
      userId: "user-1",
      cancelledRecordingOperations: {
        "upload-op-1": true,
        "older-op": true,
      },
    });

    await expect(beginPracticeAudioUpload(
      "user-1",
      "record-1",
      path,
      "upload-op-1",
    )).rejects.toThrow("was cancelled");
    expect(update).not.toHaveBeenCalled();
  });

  it("cancels only the matching pending token before declaring it deletable", async () => {
    const update = mockTransaction({
      userId: "user-1",
      pendingRecordingUpload: {
        operationId: "upload-op-1",
        path,
      },
      cancelledRecordingOperations: { "older-op": true },
    });

    await expect(resolvePracticeAudioCleanup(marker)).resolves.toBe(
      "deletable",
    );
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pendingRecordingUpload: { kind: "delete-field" },
        cancelledRecordingOperations: {
          "older-op": true,
          "upload-op-1": true,
        },
      }),
    );
  });

  it("defers an old marker instead of cancelling a newer upload", async () => {
    const update = mockTransaction({
      userId: "user-1",
      pendingRecordingUpload: {
        operationId: "upload-op-2",
        path,
      },
    });

    await expect(resolvePracticeAudioCleanup(marker)).resolves.toBe("defer");
    expect(update).not.toHaveBeenCalled();
  });

  it("finalizes only the exact active token", async () => {
    const update = mockTransaction({
      userId: "user-1",
      pendingRecordingUpload: {
        operationId: "upload-op-1",
        path,
      },
    });

    await expect(completePracticeAudioUpload(
      "user-1",
      "record-1",
      path,
      "upload-op-1",
    )).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      {
        recordingUrl: path,
        pendingRecordingUpload: { kind: "delete-field" },
      },
    );
  });

  it("blocks both begin and complete once record deletion is tombstoned", async () => {
    mockTransaction({
      userId: "user-1",
      pendingRecordDeletion: { operationId: "delete-op" },
      pendingRecordingUpload: {
        operationId: "upload-op-1",
        path,
      },
    });
    await expect(beginPracticeAudioUpload(
      "user-1",
      "record-1",
      path,
      "upload-op-1",
    )).rejects.toThrow("being deleted");

    mockTransaction({
      userId: "user-1",
      pendingRecordDeletion: { operationId: "delete-op" },
      pendingRecordingUpload: {
        operationId: "upload-op-1",
        path,
      },
    });
    await expect(completePracticeAudioUpload(
      "user-1",
      "record-1",
      path,
      "upload-op-1",
    )).rejects.toThrow("being deleted");
  });
});

describe("speech practice record pagination", () => {
  it("returns a cursor and excludes the look-ahead document", async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce(
      querySnapshot(Array.from({ length: 21 }, (_, index) => practiceDoc(index))),
    );

    const page = await getUserPracticeRecords("user-1");

    expect(page.records).toHaveLength(20);
    expect(page.hasMore).toBe(true);
    expect(page.lastDocId).toBe("record-19");
    expect(firestoreMocks.limit).toHaveBeenCalledWith(21);
  });

  it("counts every page instead of stopping at 500 records", async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce(
        querySnapshot(
          Array.from({ length: 201 }, (_, index) => practiceDoc(index)),
        ),
      )
      .mockResolvedValueOnce(
        querySnapshot(
          Array.from({ length: 201 }, (_, index) => practiceDoc(index + 200)),
        ),
      )
      .mockResolvedValueOnce(
        querySnapshot(
          Array.from({ length: 101 }, (_, index) => practiceDoc(index + 400)),
        ),
      );

    const counts = await getPracticeCountByTopic("user-1");

    expect(counts.get("topic-a")).toBe(501);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(3);
    expect(firestoreMocks.startAfter).toHaveBeenCalledTimes(2);
  });
});

describe("speech practice record deletion", () => {
  const storedData = () => ({
    userId: "user-1",
    recordingUrl: "speech-practice/user-1/record-1.mp4",
  });

  it("treats metadata deletion as success and queues failed audio cleanup", async () => {
    const transaction = mockMutableTransactions(storedData());
    storageMocks.deletePracticeAudio.mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    await expect(deletePracticeRecord("record-1", "user-1")).resolves.toBe(
      undefined,
    );

    expect(cleanupMocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith({
      userId: "user-1",
      recordId: "record-1",
      path: "speech-practice/user-1/record-1.mp4",
      reason: "deleted-record",
      operationId: expect.any(String),
      leaseExpiresAt: 0,
    });
    expect(transaction.deleteRecord).toHaveBeenCalledOnce();
    expect(storageMocks.deletePracticeAudio).toHaveBeenCalledOnce();
    expect(cleanupMocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("deletes metadata before deleting the stored audio path", async () => {
    const transaction = mockMutableTransactions(storedData());

    await deletePracticeRecord("record-1", "user-1");

    expect(transaction.deleteRecord.mock.invocationCallOrder[0]).toBeLessThan(
      storageMocks.deletePracticeAudio.mock.invocationCallOrder[0],
    );
    expect(storageMocks.deletePracticeAudio).toHaveBeenCalledWith(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.mp4",
    );
    expect(cleanupMocks.removePracticeAudioCleanup).toHaveBeenCalledWith({
      userId: "user-1",
      recordId: "record-1",
      path: "speech-practice/user-1/record-1.mp4",
      reason: "deleted-record",
      operationId: expect.any(String),
      leaseExpiresAt: 0,
    });
  });

  it("durably tracks a pending upload path before deleting its metadata", async () => {
    mockMutableTransactions({
      userId: "user-1",
      pendingRecordingUpload: {
        operationId: "upload-op-1",
        path: "speech-practice/user-1/record-1.mp4",
      },
    });

    await deletePracticeRecord("record-1", "user-1");

    expect(cleanupMocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith({
      userId: "user-1",
      recordId: "record-1",
      path: "speech-practice/user-1/record-1.mp4",
      reason: "deleted-record",
      operationId: expect.any(String),
      leaseExpiresAt: 0,
    });
    expect(storageMocks.deletePracticeAudio).toHaveBeenCalledWith(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.mp4",
    );
  });

  it("cleans audio after a server read confirms transaction lost its ACK", async () => {
    mockMutableTransactions(storedData(), { rejectDeleteAck: true });
    firestoreMocks.getDocFromServer.mockResolvedValueOnce({
      exists: () => false,
    });

    await expect(deletePracticeRecord("record-1", "user-1")).resolves.toBe(
      undefined,
    );

    expect(storageMocks.deletePracticeAudio).toHaveBeenCalledOnce();
    expect(cleanupMocks.removePracticeAudioCleanup).toHaveBeenCalledOnce();
  });

  it("keeps Storage and rejects when delete transaction did not commit", async () => {
    mockMutableTransactions(storedData(), {
      rejectDeleteBeforeCommit: true,
    });
    firestoreMocks.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: storedData,
    });

    await expect(deletePracticeRecord("record-1", "user-1")).rejects.toThrow(
      "permission",
    );

    expect(storageMocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(cleanupMocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("keeps Storage and rejects when delete outcome cannot be verified", async () => {
    mockMutableTransactions(storedData(), { rejectDeleteAck: true });
    firestoreMocks.getDocFromServer.mockRejectedValueOnce(new Error("offline"));

    await expect(deletePracticeRecord("record-1", "user-1")).rejects.toThrow(
      "lost ACK",
    );

    expect(storageMocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(cleanupMocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("refuses metadata deletion when no durable cleanup marker can be saved", async () => {
    const transaction = mockMutableTransactions(storedData());
    cleanupMocks.enqueuePracticeAudioCleanup.mockReturnValueOnce(false);

    await expect(deletePracticeRecord("record-1", "user-1")).rejects.toThrow(
      "persist practice audio cleanup marker",
    );

    expect(transaction.deleteRecord).not.toHaveBeenCalled();
    expect(storageMocks.deletePracticeAudio).not.toHaveBeenCalled();
  });
});
