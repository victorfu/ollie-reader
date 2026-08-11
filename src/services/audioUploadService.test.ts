import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  startAfter: vi.fn((cursor: unknown) => ({ kind: "after", cursor })),
  deleteFieldToken: { kind: "delete-field" },
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  deleteDoc: mocks.deleteDoc,
  doc: vi.fn((_db: unknown, _collection: string, id: string) => ({
    kind: "document",
    id,
  })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  where: vi.fn(() => ({ kind: "where" })),
  getDocs: mocks.getDocs,
  getDocsFromServer: mocks.getDocsFromServer,
  getDocFromServer: mocks.getDocFromServer,
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
  orderBy: vi.fn(() => ({ kind: "order" })),
  limit: vi.fn((value: number) => ({ kind: "limit", value })),
  startAfter: mocks.startAfter,
  updateDoc: mocks.updateDoc,
  deleteField: vi.fn(() => mocks.deleteFieldToken),
  runTransaction: mocks.runTransaction,
}));

vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));
vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "audio",
  supabase: {
    storage: {
      from: vi.fn(() => ({
        remove: mocks.remove,
        upload: mocks.upload,
        createSignedUrl: vi.fn(),
      })),
    },
  },
}));

import {
  addAudioUpload,
  createAudioUploadPath,
  deleteAudioFileForOwner,
  deleteAudioUpload,
  audioUploadMetadataExists,
  audioUploadMetadataExistsById,
  getUserAudioUploads,
  uploadAudioFile,
  updateAudioUpload,
} from "./audioUploadService";

function snapshot(id: string) {
  return {
    id,
    data: () => ({
      userId: "user-1",
      title: id,
      audioUrl: `${id}.mp3`,
      durationSeconds: 1,
      fileSize: 1,
      mimeType: "audio/mpeg",
      createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
    }),
  };
}

describe("audioUploadService consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentUser = { uid: "user-1" };
    mocks.deleteDoc.mockResolvedValue(undefined);
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.upload.mockResolvedValue({ error: null });
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
            id: "upload-1",
            exists: () => false,
          }),
          set: vi.fn(),
        }),
    );
  });

  it("uploads only to the exact owner path computed before the mutation", async () => {
    const path = createAudioUploadPath("user-1", "upload-1", "audio/mpeg");
    const file = new File(["audio"], "lesson.mp3", { type: "audio/mpeg" });

    await uploadAudioFile("user-1", path, file, file.type);

    expect(path).toBe("audio-uploads/user-1/upload-1.mp3");
    expect(mocks.upload).toHaveBeenCalledWith(path, file, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  });

  it("creates metadata through a deterministic non-queued transaction", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue({
        id: "upload-1",
        exists: () => false,
      }),
      set: vi.fn(),
    };
    mocks.runTransaction.mockImplementation(
      async (_db: unknown, update: (value: typeof transaction) => Promise<unknown>) =>
        update(transaction),
    );

    await expect(
      addAudioUpload("upload-1", {
        userId: "user-1",
        title: "Lesson",
        audioUrl: "audio-uploads/user-1/upload-1.mp3",
        durationSeconds: 12,
        fileSize: 5,
        mimeType: "audio/mpeg",
      }),
    ).resolves.toBe("upload-1");

    expect(transaction.get).toHaveBeenCalledWith(
      expect.objectContaining({ id: "upload-1" }),
    );
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: "upload-1" }),
      expect.objectContaining({
        userId: "user-1",
        audioUrl: "audio-uploads/user-1/upload-1.mp3",
      }),
    );
  });

  it("loads every page instead of treating the first page as the full library", async () => {
    const first = [snapshot("a"), snapshot("b")];
    const second = [snapshot("c")];
    mocks.getDocs
      .mockResolvedValueOnce({ docs: first })
      .mockResolvedValueOnce({ docs: second });

    const result = await getUserAudioUploads("user-1", 2);

    expect(result.map((upload) => upload.id)).toEqual(["a", "b", "c"]);
    expect(mocks.getDocs).toHaveBeenCalledTimes(2);
    expect(mocks.startAfter).toHaveBeenCalledWith(first[1]);
  });

  it("deletes metadata without touching Storage before the durable cleanup stage", async () => {
    await deleteAudioUpload("audio-1");

    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("uses a server-authoritative query before treating an object as unreferenced", async () => {
    mocks.getDocsFromServer.mockResolvedValue({ empty: true });

    await expect(
      audioUploadMetadataExists(
        "user-1",
        "audio-uploads/user-1/audio-1.mp3",
      ),
    ).resolves.toBe(false);
    expect(mocks.getDocsFromServer).toHaveBeenCalledTimes(1);
    expect(mocks.getDocs).not.toHaveBeenCalled();
  });

  it("uses a server-authoritative document read after a rejected metadata delete", async () => {
    mocks.getDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => ({
        userId: "user-1",
        audioUrl: "audio-uploads/user-1/audio-1.mp3",
      }),
    });

    await expect(
      audioUploadMetadataExistsById(
        "user-1",
        "audio-1",
        "audio-uploads/user-1/audio-1.mp3",
      ),
    ).resolves.toBe(true);
    expect(mocks.getDocFromServer).toHaveBeenCalledTimes(1);
  });

  it("never retries one owner's cleanup with another owner's credentials", async () => {
    mocks.auth.currentUser = { uid: "user-2" };

    await expect(
      deleteAudioFileForOwner("user-1", "audio-uploads/user-1/audio-1.mp3"),
    ).rejects.toThrow("帳號已切換");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes a description field when the user clears it", async () => {
    await updateAudioUpload("audio-1", { description: "" });

    expect(mocks.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { description: mocks.deleteFieldToken },
    );
  });
});
