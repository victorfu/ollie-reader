import { act, StrictMode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "user-1" } as { uid: string } | null },
  createAudioUploadPath: vi.fn(),
  uploadAudioFile: vi.fn(),
  addAudioUpload: vi.fn(),
  getUserAudioUploads: vi.fn(),
  updateAudioUpload: vi.fn(),
  deleteAudioUpload: vi.fn(),
  deleteAudioFileForOwner: vi.fn(),
  audioUploadMetadataExists: vi.fn(),
  audioUploadMetadataExistsById: vi.fn(),
  getAudioUploadSignedUrl: vi.fn(),
  acquireAudioUploadOperationLock: vi.fn(),
  runWithAudioUploadCleanupLock: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("../services/audioUploadService", () => ({
  createAudioUploadPath: mocks.createAudioUploadPath,
  uploadAudioFile: mocks.uploadAudioFile,
  addAudioUpload: mocks.addAudioUpload,
  getUserAudioUploads: mocks.getUserAudioUploads,
  updateAudioUpload: mocks.updateAudioUpload,
  deleteAudioUpload: mocks.deleteAudioUpload,
  deleteAudioFileForOwner: mocks.deleteAudioFileForOwner,
  audioUploadMetadataExists: mocks.audioUploadMetadataExists,
  audioUploadMetadataExistsById: mocks.audioUploadMetadataExistsById,
  getAudioUploadSignedUrl: mocks.getAudioUploadSignedUrl,
}));
vi.mock("../services/audioUploadOperationLock", () => ({
  acquireAudioUploadOperationLock: mocks.acquireAudioUploadOperationLock,
  runWithAudioUploadCleanupLock: mocks.runWithAudioUploadCleanupLock,
}));

import { useAudioUploads } from "./useAudioUploads";
import {
  enqueueAudioUploadCleanup,
  listAudioUploadCleanupMarkers,
  listAudioUploadCleanups,
  removeAudioUploadCleanup,
} from "../services/audioUploadCleanupQueue";

type AudioHook = ReturnType<typeof useAudioUploads>;

function savedUpload(id: string, audioUrl: string) {
  return {
    id,
    userId: "user-1",
    title: "Saved lesson",
    audioUrl,
    durationSeconds: 12,
    fileSize: 5,
    mimeType: "audio/mpeg",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

class MetadataAudio extends EventTarget {
  duration = 12;

  set src(_value: string) {
    queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function renderHook(options: { strict?: boolean } = {}) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  let current: AudioHook | null = null;

  function Harness() {
    const value = useAudioUploads();
    useEffect(() => {
      current = value;
    });
    return null;
  }

  const renderHarness = () =>
    options.strict ? (
      <StrictMode>
        <Harness />
      </StrictMode>
    ) : (
      <Harness />
    );

  act(() => root.render(renderHarness()));
  return {
    get current() {
      if (!current) throw new Error("audio upload hook did not render");
      return current;
    },
    rerender() {
      act(() => root.render(renderHarness()));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useAudioUploads failure consistency", () => {
  let hook: ReturnType<typeof renderHook> | null = null;
  let originalAudio: typeof Audio;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { uid: "user-1" };
    mocks.createAudioUploadPath.mockImplementation(
      (uid: string, uploadId: string) =>
        `audio-uploads/${uid}/${uploadId}.mp3`,
    );
    mocks.uploadAudioFile.mockResolvedValue(undefined);
    mocks.getUserAudioUploads.mockResolvedValue([]);
    mocks.addAudioUpload.mockResolvedValue("metadata-1");
    mocks.deleteAudioUpload.mockResolvedValue(undefined);
    mocks.deleteAudioFileForOwner.mockResolvedValue(undefined);
    mocks.audioUploadMetadataExists.mockResolvedValue(false);
    mocks.audioUploadMetadataExistsById.mockResolvedValue(false);
    mocks.acquireAudioUploadOperationLock.mockResolvedValue({
      crossTabProtected: true,
      release: vi.fn(),
    });
    mocks.runWithAudioUploadCleanupLock.mockImplementation(
      async (_path: string, cleanup: () => Promise<void>) => {
        await cleanup();
        return "completed";
      },
    );
    localStorage.clear();
    for (const path of listAudioUploadCleanups("user-1")) {
      removeAudioUploadCleanup("user-1", path);
    }
    originalAudio = globalThis.Audio;
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: MetadataAudio,
    });
  });

  afterEach(() => {
    hook?.unmount();
    hook = null;
    for (const path of listAudioUploadCleanups("user-1")) {
      removeAudioUploadCleanup("user-1", path);
    }
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: originalAudio,
    });
    vi.restoreAllMocks();
  });

  it("restores the active owner after React StrictMode effect replay", async () => {
    const path = "audio-uploads/user-1/strict-mode.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    hook = renderHook({ strict: true });
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(result?.success).toBe(true);
    expect(mocks.addAudioUpload).toHaveBeenCalledTimes(1);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("removes an uploaded object when creating its metadata fails", async () => {
    const path = "audio-uploads/user-1/temp.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.addAudioUpload.mockRejectedValue(new Error("firestore unavailable"));
    hook = renderHook();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(result?.success).toBe(false);
    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledWith(
      "user-1",
      path,
    );
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("keeps an uploaded object when metadata committed but its write acknowledgement was lost", async () => {
    const path = "audio-uploads/user-1/committed-without-ack.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.addAudioUpload.mockRejectedValue(new Error("response lost"));
    mocks.audioUploadMetadataExistsById.mockResolvedValue(true);
    hook = renderHook();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(result?.success).toBe(true);
    expect(mocks.audioUploadMetadataExistsById).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      path,
    );
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("defers deletion when metadata existence cannot be determined", async () => {
    const path = "audio-uploads/user-1/metadata-lookup-offline.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.addAudioUpload.mockRejectedValue(new Error("response lost"));
    mocks.audioUploadMetadataExistsById.mockRejectedValue(
      new Error("metadata lookup offline"),
    );
    hook = renderHook();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(result?.success).toBe(false);
    expect(mocks.audioUploadMetadataExistsById).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      path,
    );
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);
  });

  it("durably retries a double-failed rollback for the same signed-in owner", async () => {
    const path = "audio-uploads/user-1/retry.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.addAudioUpload.mockRejectedValue(new Error("firestore unavailable"));
    mocks.deleteAudioFileForOwner
      .mockRejectedValueOnce(new Error("storage offline"))
      .mockResolvedValue(undefined);
    hook = renderHook();

    await act(async () => {
      await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(listAudioUploadCleanups("user-1")).toEqual([path]);
    hook.unmount();
    hook = renderHook();
    await flushAsyncWork();

    expect(mocks.deleteAudioFileForOwner).toHaveBeenLastCalledWith(
      "user-1",
      path,
    );
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("does not create metadata after unmount and leaves cleanup to that owner", async () => {
    const path = "audio-uploads/user-1/unmounted.mp3";
    const storageUpload = deferred<void>();
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.uploadAudioFile.mockReturnValue(storageUpload.promise);
    mocks.addAudioUpload.mockResolvedValue("metadata-1");
    hook = renderHook();

    let uploadResult:
      | Awaited<ReturnType<AudioHook["uploadAudio"]>>
      | undefined;
    let uploadPromise: Promise<
      Awaited<ReturnType<AudioHook["uploadAudio"]>>
    > | undefined;
    await act(async () => {
      uploadPromise = hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
      await Promise.resolve();
    });
    hook.unmount();
    hook = null;

    await act(async () => {
      storageUpload.resolve();
      uploadResult = await uploadPromise;
    });

    expect(uploadResult?.success).toBe(false);
    expect(mocks.addAudioUpload).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);
  });

  it("never continues user-1 metadata or cleanup with user-2 credentials", async () => {
    const path = "audio-uploads/user-1/account-switched.mp3";
    const storageUpload = deferred<void>();
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.uploadAudioFile.mockReturnValue(storageUpload.promise);
    hook = renderHook();

    let uploadPromise: Promise<
      Awaited<ReturnType<AudioHook["uploadAudio"]>>
    > | undefined;
    await act(async () => {
      uploadPromise = hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    mocks.auth.user = { uid: "user-2" };
    hook.rerender();
    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      storageUpload.resolve();
      result = await uploadPromise;
    });

    expect(result).toEqual({
      success: false,
      message: "帳號已切換，上傳已取消",
    });
    expect(mocks.addAudioUpload).not.toHaveBeenCalled();
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);
    expect(listAudioUploadCleanups("user-2")).toEqual([]);
  });

  it("keeps a pre-upload marker when Storage may have committed without an acknowledgement", async () => {
    const path = "audio-uploads/user-1/storage-lost-ack.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.uploadAudioFile.mockRejectedValue(new Error("upload response lost"));
    hook = renderHook();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });

    expect(result?.success).toBe(false);
    expect(mocks.addAudioUpload).not.toHaveBeenCalled();
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      {
        audioPath: path,
        reason: "orphaned-upload",
        notBefore: expect.any(Number),
      },
    ]);

    hook.unmount();
    hook = renderHook();
    await flushAsyncWork();
    expect(mocks.audioUploadMetadataExists).toHaveBeenCalledWith("user-1", path);
    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledWith("user-1", path);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("durably marks the exact path before mutating Storage or creating metadata", async () => {
    const path = "audio-uploads/user-1/pre-metadata-crash.mp3";
    const metadataWrite = deferred<string>();
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.uploadAudioFile.mockImplementation(async () => {
      expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
        {
          audioPath: path,
          reason: "orphaned-upload",
          notBefore: expect.any(Number),
        },
      ]);
      expect(mocks.acquireAudioUploadOperationLock).toHaveBeenCalledWith(path);
    });
    mocks.addAudioUpload.mockReturnValue(metadataWrite.promise);
    hook = renderHook();

    let uploadPromise: Promise<
      Awaited<ReturnType<AudioHook["uploadAudio"]>>
    > | undefined;
    await act(async () => {
      uploadPromise = hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocks.addAudioUpload).toHaveBeenCalledTimes(1);
    expect(mocks.uploadAudioFile).toHaveBeenCalledWith(
      "user-1",
      path,
      expect.any(File),
      "audio/mpeg",
    );
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      {
        audioPath: path,
        reason: "orphaned-upload",
        notBefore: expect.any(Number),
      },
    ]);

    await act(async () => {
      metadataWrite.resolve("metadata-1");
      await uploadPromise;
    });
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("does not mutate Storage when the pre-upload cleanup marker cannot persist", async () => {
    const path = "audio-uploads/user-1/no-durable-upload-marker.mp3";
    mocks.createAudioUploadPath.mockReturnValue(path);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    hook = renderHook();

    let result: Awaited<ReturnType<AudioHook["uploadAudio"]>> | undefined;
    await act(async () => {
      result = await hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
    });
    setItem.mockRestore();

    expect(result?.success).toBe(false);
    expect(mocks.uploadAudioFile).not.toHaveBeenCalled();
    expect(mocks.addAudioUpload).not.toHaveBeenCalled();
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("does not clean a live upload even after the crash grace expires", async () => {
    const path = "audio-uploads/user-1/long-running.mp3";
    const storageUpload = deferred<void>();
    const now = 1_800_000_000_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    mocks.createAudioUploadPath.mockReturnValue(path);
    mocks.uploadAudioFile.mockReturnValue(storageUpload.promise);
    hook = renderHook();

    let uploadPromise: Promise<
      Awaited<ReturnType<AudioHook["uploadAudio"]>>
    > | undefined;
    await act(async () => {
      uploadPromise = hook?.current.uploadAudio(
        new File(["audio"], "lesson.mp3", { type: "audio/mpeg" }),
        "Lesson",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocks.uploadAudioFile).toHaveBeenCalledTimes(1);
    dateNow.mockReturnValue(now + 120_000);
    window.dispatchEvent(new Event("online"));
    await flushAsyncWork();

    expect(mocks.runWithAudioUploadCleanupLock).not.toHaveBeenCalled();
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);

    await act(async () => {
      storageUpload.resolve();
      await uploadPromise;
    });
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it.each(["busy", "unsupported"] as const)(
    "keeps cleanup queued when the cross-tab lock result is %s",
    async (lockResult) => {
      const path = `audio-uploads/user-1/cleanup-${lockResult}.mp3`;
      enqueueAudioUploadCleanup("user-1", path, {
        reason: "orphaned-upload",
        requireDurable: true,
        notBefore: Date.now(),
      });
      mocks.runWithAudioUploadCleanupLock.mockResolvedValue(lockResult);

      hook = renderHook();
      await flushAsyncWork();

      expect(mocks.runWithAudioUploadCleanupLock).toHaveBeenCalledWith(
        path,
        expect.any(Function),
      );
      expect(mocks.audioUploadMetadataExists).not.toHaveBeenCalled();
      expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
      expect(listAudioUploadCleanups("user-1")).toEqual([path]);
    },
  );

  it("keeps a file when an ambiguous failure already created its metadata", async () => {
    const path = "audio-uploads/user-1/committed.mp3";
    enqueueAudioUploadCleanup("user-1", path);
    mocks.audioUploadMetadataExists.mockResolvedValue(true);

    hook = renderHook();
    await flushAsyncWork();

    expect(mocks.audioUploadMetadataExists).toHaveBeenCalledWith("user-1", path);
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("does not clean an unreferenced upload while its metadata request may still be in flight", async () => {
    const path = "audio-uploads/user-1/metadata-in-flight.mp3";
    const now = 1_800_000_000_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    enqueueAudioUploadCleanup("user-1", path, {
      reason: "orphaned-upload",
      requireDurable: true,
      notBefore: now + 60_000,
    });
    mocks.audioUploadMetadataExists.mockResolvedValue(false);

    hook = renderHook();
    await flushAsyncWork();
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);

    dateNow.mockReturnValue(now + 60_001);
    window.dispatchEvent(new Event("online"));
    await flushAsyncWork();
    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledWith("user-1", path);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("keeps a delete-intent marker while metadata still references the file", async () => {
    const path = "audio-uploads/user-1/delete-still-referenced.mp3";
    enqueueAudioUploadCleanup("user-1", path, {
      reason: "deleted-record",
      requireDurable: true,
    });
    mocks.audioUploadMetadataExists.mockResolvedValue(true);

    hook = renderHook();
    await flushAsyncWork();

    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);
  });

  it("retries a pending owner cleanup when connectivity returns", async () => {
    const path = "audio-uploads/user-1/online-retry.mp3";
    enqueueAudioUploadCleanup("user-1", path);
    mocks.deleteAudioFileForOwner
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);

    hook = renderHook();
    await flushAsyncWork();
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);

    window.dispatchEvent(new Event("online"));
    await flushAsyncWork();

    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledTimes(2);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("treats metadata deletion as success and durably retries failed Storage cleanup", async () => {
    const path = "audio-uploads/user-1/delete-storage-offline.mp3";
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioFileForOwner.mockRejectedValue(new Error("offline"));
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });

    expect(result?.success).toBe(true);
    expect(hook.current.uploads).toEqual([]);
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);
  });

  it("returns logical deletion success without waiting for background Storage cleanup", async () => {
    const path = "audio-uploads/user-1/delete-storage-pending.mp3";
    const storageDelete = deferred<void>();
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioFileForOwner.mockReturnValue(storageDelete.promise);
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });

    expect(result?.success).toBe(true);
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);

    storageDelete.resolve();
    await flushAsyncWork();
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("finishes deletion when a rejected deleteDoc is authoritatively absent", async () => {
    const path = "audio-uploads/user-1/delete-lost-ack.mp3";
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioUpload.mockRejectedValue(new Error("response lost"));
    mocks.audioUploadMetadataExistsById.mockResolvedValue(false);
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });

    expect(result?.success).toBe(true);
    expect(mocks.audioUploadMetadataExistsById).toHaveBeenCalledWith(
      "user-1",
      "audio-1",
      path,
    );
    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledWith("user-1", path);
    expect(hook.current.uploads).toEqual([]);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("preserves Storage when a rejected deleteDoc is authoritatively still present", async () => {
    const path = "audio-uploads/user-1/delete-not-committed.mp3";
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioUpload.mockRejectedValue(new Error("delete failed"));
    mocks.audioUploadMetadataExistsById.mockResolvedValue(true);
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });

    expect(result?.success).toBe(false);
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(hook.current.uploads).toHaveLength(1);
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);
  });

  it("preserves Storage when a rejected deleteDoc cannot be verified from the server", async () => {
    const path = "audio-uploads/user-1/delete-ambiguous.mp3";
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioUpload.mockRejectedValue(new Error("response lost"));
    mocks.audioUploadMetadataExistsById.mockRejectedValue(
      new Error("server unavailable"),
    );
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });

    expect(result?.success).toBe(false);
    expect(mocks.deleteAudioFileForOwner).not.toHaveBeenCalled();
    expect(hook.current.uploads).toHaveLength(1);
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);
  });

  it("persists delete intent before deleteDoc and survives unmount after commit", async () => {
    const path = "audio-uploads/user-1/delete-crash-window.mp3";
    const metadataDelete = deferred<void>();
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    mocks.deleteAudioUpload.mockReturnValue(metadataDelete.promise);
    hook = renderHook();
    await flushAsyncWork();

    let deletePromise: Promise<
      Awaited<ReturnType<AudioHook["deleteUpload"]>>
    > | undefined;
    await act(async () => {
      deletePromise = hook?.current.deleteUpload("audio-1", path);
      await Promise.resolve();
    });

    expect(mocks.deleteAudioUpload).toHaveBeenCalledWith("audio-1");
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);

    hook.unmount();
    hook = null;
    await act(async () => {
      metadataDelete.resolve();
      await deletePromise;
    });
    expect(listAudioUploadCleanups("user-1")).toEqual([path]);

    hook = renderHook();
    await flushAsyncWork();
    expect(mocks.deleteAudioFileForOwner).toHaveBeenCalledWith("user-1", path);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("does not delete metadata when delete intent cannot be persisted", async () => {
    const path = "audio-uploads/user-1/no-durable-delete-marker.mp3";
    mocks.getUserAudioUploads.mockResolvedValue([savedUpload("audio-1", path)]);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    hook = renderHook();
    await flushAsyncWork();

    let result: Awaited<ReturnType<AudioHook["deleteUpload"]>> | undefined;
    await act(async () => {
      result = await hook?.current.deleteUpload("audio-1", path);
    });
    setItem.mockRestore();

    expect(result?.success).toBe(false);
    expect(mocks.deleteAudioUpload).not.toHaveBeenCalled();
    expect(hook.current.uploads).toHaveLength(1);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });
});
