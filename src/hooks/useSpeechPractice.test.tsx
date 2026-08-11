import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeRecord } from "../types/speechPractice";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  addPracticeRecord: vi.fn(),
  getUserPracticeRecords: vi.fn(),
  deletePracticeRecord: vi.fn(),
  getPracticeCountByTopic: vi.fn(),
  getUserScripts: vi.fn(),
  saveTopicScript: vi.fn(),
  getTopicScript: vi.fn(),
  beginPracticeAudioUpload: vi.fn(),
  completePracticeAudioUpload: vi.fn(),
  resolvePracticeAudioCleanup: vi.fn(),
  getPracticeAudioPath: vi.fn(),
  uploadPracticeAudio: vi.fn(),
  deletePracticeAudio: vi.fn(),
  enqueuePracticeAudioCleanup: vi.fn(),
  removePracticeAudioCleanup: vi.fn(),
  retryPracticeAudioCleanupQueue: vi.fn(),
  runWithPracticeAudioOperationLock: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../services/speechPracticeService", () => ({
  addPracticeRecord: mocks.addPracticeRecord,
  getUserPracticeRecords: mocks.getUserPracticeRecords,
  deletePracticeRecord: mocks.deletePracticeRecord,
  getPracticeCountByTopic: mocks.getPracticeCountByTopic,
  getUserScripts: mocks.getUserScripts,
  saveTopicScript: mocks.saveTopicScript,
  getTopicScript: mocks.getTopicScript,
  beginPracticeAudioUpload: mocks.beginPracticeAudioUpload,
  completePracticeAudioUpload: mocks.completePracticeAudioUpload,
  resolvePracticeAudioCleanup: mocks.resolvePracticeAudioCleanup,
}));
vi.mock("../services/audioStorageService", () => ({
  MAX_AUDIO_SIZE_BYTES: 10 * 1024 * 1024,
  uploadPracticeAudio: mocks.uploadPracticeAudio,
  deletePracticeAudio: mocks.deletePracticeAudio,
  getPracticeAudioPath: mocks.getPracticeAudioPath,
}));
vi.mock("../services/practiceAudioCleanupQueue", () => ({
  enqueuePracticeAudioCleanup: mocks.enqueuePracticeAudioCleanup,
  removePracticeAudioCleanup: mocks.removePracticeAudioCleanup,
  retryPracticeAudioCleanupQueue: mocks.retryPracticeAudioCleanupQueue,
  runWithPracticeAudioOperationLock:
    mocks.runWithPracticeAudioOperationLock,
}));

import { useSpeechPractice } from "./useSpeechPractice";

type SpeechPracticeHook = ReturnType<typeof useSpeechPractice>;

function practiceRecord(id: string, userId = "user-1"): PracticeRecord {
  return {
    id,
    topicId: "topic-a",
    topicTitle: "Topic A",
    userId,
    durationSeconds: 30,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

let root: Root | null;
let host: HTMLDivElement | null;
let currentHook: SpeechPracticeHook | null;

function Probe() {
  const speechPractice = useSpeechPractice();
  useEffect(() => {
    currentHook = speechPractice;
  });
  return null;
}

function hook(): SpeechPracticeHook {
  if (!currentHook) throw new Error("Speech practice hook did not render");
  return currentHook;
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  root = null;
  host = document.createElement("div");
  document.body.appendChild(host);
  currentHook = null;

  mocks.useAuth.mockReturnValue({ user: { uid: "user-1" } });
  mocks.getUserPracticeRecords.mockResolvedValue({
    records: [practiceRecord("record-1")],
    hasMore: false,
    lastDocId: "record-1",
  });
  mocks.getPracticeCountByTopic.mockResolvedValue(new Map());
  mocks.getUserScripts.mockResolvedValue(new Map());
  mocks.getPracticeAudioPath.mockImplementation(
    (userId: string, recordId: string) => (
      `speech-practice/${userId}/${recordId}.mp4`
    ),
  );
  mocks.beginPracticeAudioUpload.mockResolvedValue(undefined);
  mocks.completePracticeAudioUpload.mockResolvedValue(undefined);
  mocks.resolvePracticeAudioCleanup.mockResolvedValue("deletable");
  mocks.deletePracticeAudio.mockResolvedValue(undefined);
  mocks.enqueuePracticeAudioCleanup.mockReturnValue(true);
  mocks.removePracticeAudioCleanup.mockReturnValue(true);
  mocks.retryPracticeAudioCleanupQueue.mockResolvedValue(0);
  mocks.runWithPracticeAudioOperationLock.mockImplementation(
    async (_cleanup: unknown, work: () => Promise<unknown>) => ({
      acquired: true,
      usedWebLock: true,
      value: await work(),
    }),
  );

  root = createRoot(host);
  await act(async () => {
    root?.render(<Probe />);
  });
  await flushAsyncWork();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
});

describe("useSpeechPractice persistence", () => {
  const expectedCleanup = () => ({
    userId: "user-1",
    recordId: "record-2",
    path: "speech-practice/user-1/record-2.mp4",
    reason: "orphaned-upload",
    operationId: expect.any(String),
    leaseExpiresAt: expect.any(Number),
  });

  it("rolls back an uploaded object when finalize cannot be committed", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockResolvedValueOnce(
      "speech-practice/user-1/record-2.mp4",
    );
    mocks.completePracticeAudioUpload.mockRejectedValueOnce(
      new Error("Firestore unavailable"),
    );

    let result: Awaited<ReturnType<SpeechPracticeHook["saveRecord"]>> | undefined;
    await act(async () => {
      result = await hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });

    expect(mocks.deletePracticeAudio).toHaveBeenCalledWith(
      "user-1",
      "record-2",
      "speech-practice/user-1/record-2.mp4",
    );
    expect(result).toEqual({
      success: true,
      message: "練習記錄已儲存，但錄音未能儲存",
      recordId: "record-2",
    });
    expect(mocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith(
      expectedCleanup(),
    );
    expect(mocks.removePracticeAudioCleanup).toHaveBeenCalledWith(
      expectedCleanup(),
    );
  });

  it("durably queues the orphan when metadata and rollback both fail", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockResolvedValueOnce(
      "speech-practice/user-1/record-2.mp4",
    );
    mocks.completePracticeAudioUpload.mockRejectedValueOnce(
      new Error("Firestore unavailable"),
    );
    mocks.deletePracticeAudio.mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    await act(async () => {
      await hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });

    expect(mocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith(
      expectedCleanup(),
    );
    expect(mocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("preserves audio when transactional reconciliation confirms a lost ACK", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    const cleanup = {
      userId: "user-1",
      recordId: "record-2",
      path: "speech-practice/user-1/record-2.mp4",
      reason: "orphaned-upload" as const,
      operationId: expect.any(String),
      leaseExpiresAt: expect.any(Number),
    };
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockResolvedValueOnce(cleanup.path);
    mocks.completePracticeAudioUpload.mockRejectedValueOnce(
      new Error("lost ACK"),
    );
    mocks.resolvePracticeAudioCleanup.mockResolvedValueOnce("referenced");

    let result: Awaited<ReturnType<SpeechPracticeHook["saveRecord"]>> | undefined;
    await act(async () => {
      result = await hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });

    expect(mocks.resolvePracticeAudioCleanup).toHaveBeenCalledWith(
      cleanup,
      expect.any(Function),
    );
    expect(mocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(mocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith(cleanup);
    expect(mocks.removePracticeAudioCleanup).toHaveBeenCalledWith(cleanup);
    expect(result).toEqual({
      success: true,
      message: "練習記錄已儲存",
      recordId: "record-2",
    });
  });

  it("queues without deleting when the authoritative lookup is ambiguous", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockResolvedValueOnce(
      "speech-practice/user-1/record-2.mp4",
    );
    mocks.completePracticeAudioUpload.mockRejectedValueOnce(
      new Error("lost ACK"),
    );
    mocks.resolvePracticeAudioCleanup.mockRejectedValueOnce(
      new Error("offline"),
    );

    await act(async () => {
      await hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });

    expect(mocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(mocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith(
      expectedCleanup(),
    );
    expect(mocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("persists cleanup and reserves the token before starting Storage", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    const upload = deferred<string>();
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockReturnValueOnce(upload.promise);

    let savePromise!: ReturnType<SpeechPracticeHook["saveRecord"]>;
    act(() => {
      savePromise = hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });
    await flushAsyncWork();

    expect(mocks.beginPracticeAudioUpload).toHaveBeenCalledOnce();
    expect(mocks.uploadPracticeAudio).toHaveBeenCalledOnce();
    expect(
      mocks.enqueuePracticeAudioCleanup.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.beginPracticeAudioUpload.mock.invocationCallOrder[0],
    );
    expect(
      mocks.beginPracticeAudioUpload.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.uploadPracticeAudio.mock.invocationCallOrder[0],
    );
    expect(mocks.completePracticeAudioUpload).not.toHaveBeenCalled();
    expect(mocks.removePracticeAudioCleanup).not.toHaveBeenCalled();

    // Simulate a tab closing while Firestore is still waiting for an ACK. The
    // durable marker was already written and no cleanup request is issued with
    // a future account's credentials.
    act(() => root?.unmount());
    root = null;
    upload.resolve("speech-practice/user-1/record-2.mp4");
    await savePromise;

    expect(mocks.completePracticeAudioUpload).not.toHaveBeenCalled();
    expect(mocks.resolvePracticeAudioCleanup).not.toHaveBeenCalled();
    expect(mocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(mocks.removePracticeAudioCleanup).not.toHaveBeenCalled();
  });

  it("skips Storage when the durable marker cannot be established", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.enqueuePracticeAudioCleanup.mockReturnValueOnce(false);

    let result: Awaited<ReturnType<SpeechPracticeHook["saveRecord"]>> | undefined;
    await act(async () => {
      result = await hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });

    expect(mocks.beginPracticeAudioUpload).not.toHaveBeenCalled();
    expect(mocks.uploadPracticeAudio).not.toHaveBeenCalled();
    expect(mocks.completePracticeAudioUpload).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: "練習記錄已儲存，但錄音未能儲存",
      recordId: "record-2",
    });
  });

  it("does not use account B to finalize or delete account A's late upload", async () => {
    const audio = new Blob(["audio"], { type: "audio/mp4" });
    const upload = deferred<string>();
    mocks.addPracticeRecord.mockResolvedValueOnce("record-2");
    mocks.uploadPracticeAudio.mockReturnValueOnce(upload.promise);

    let savePromise!: ReturnType<SpeechPracticeHook["saveRecord"]>;
    act(() => {
      savePromise = hook().saveRecord(
        {
          topicId: "topic-a",
          topicTitle: "Topic A",
          durationSeconds: 30,
        },
        audio,
      );
    });
    await flushAsyncWork();
    expect(mocks.uploadPracticeAudio).toHaveBeenCalledWith(
      "user-1",
      "record-2",
      audio,
    );

    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    await act(async () => {
      root?.render(<Probe />);
    });
    await flushAsyncWork();

    await act(async () => {
      upload.resolve("speech-practice/user-1/record-2.mp4");
      await savePromise;
    });

    expect(mocks.completePracticeAudioUpload).not.toHaveBeenCalled();
    expect(mocks.deletePracticeAudio).not.toHaveBeenCalled();
    expect(mocks.enqueuePracticeAudioCleanup).toHaveBeenCalledWith(
      expectedCleanup(),
    );
  });

  it("appends every history page without replacing the first page", async () => {
    mocks.getUserPracticeRecords.mockResolvedValueOnce({
      records: [practiceRecord("record-2")],
      hasMore: true,
      lastDocId: "record-2",
    });
    await act(async () => {
      await hook().loadRecords();
    });
    mocks.getUserPracticeRecords.mockResolvedValueOnce({
      records: [practiceRecord("record-3")],
      hasMore: false,
      lastDocId: "record-3",
    });

    await act(async () => {
      await hook().loadMoreRecords();
    });

    expect(hook().records.map((record) => record.id)).toEqual([
      "record-2",
      "record-3",
    ]);
    expect(hook().hasMoreRecords).toBe(false);
    expect(mocks.getUserPracticeRecords).toHaveBeenLastCalledWith("user-1", {
      cursor: "record-2",
    }, expect.any(Function));
  });

  it("ignores late topic counts and scripts from a previous account", async () => {
    const lateRecords = deferred<{
      records: PracticeRecord[];
      hasMore: boolean;
      lastDocId: string;
    }>();
    const lateCounts = deferred<Map<string, number>>();
    const lateScripts = deferred<Map<string, string>>();
    mocks.getUserPracticeRecords.mockReturnValueOnce(lateRecords.promise);
    mocks.getPracticeCountByTopic.mockReturnValueOnce(lateCounts.promise);
    mocks.getUserScripts.mockReturnValueOnce(lateScripts.promise);
    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });

    await act(async () => {
      root?.render(<Probe />);
    });

    expect(hook().records).toEqual([]);
    expect([...hook().topicCounts]).toEqual([]);
    expect([...hook().topicScripts]).toEqual([]);

    mocks.getUserPracticeRecords.mockResolvedValueOnce({
      records: [practiceRecord("record-3", "user-3")],
      hasMore: false,
      lastDocId: "record-3",
    });
    mocks.getPracticeCountByTopic.mockResolvedValueOnce(
      new Map([["topic-c", 3]]),
    );
    mocks.getUserScripts.mockResolvedValueOnce(
      new Map([["topic-c", "User 3 script"]]),
    );
    mocks.useAuth.mockReturnValue({ user: { uid: "user-3" } });
    await act(async () => {
      root?.render(<Probe />);
    });
    await flushAsyncWork();

    expect(hook().records.map((record) => record.userId)).toEqual(["user-3"]);
    expect([...hook().topicCounts]).toEqual([["topic-c", 3]]);
    expect([...hook().topicScripts]).toEqual([
      ["topic-c", "User 3 script"],
    ]);

    await act(async () => {
      lateRecords.resolve({
        records: [practiceRecord("record-2", "user-2")],
        hasMore: false,
        lastDocId: "record-2",
      });
      lateCounts.resolve(new Map([["topic-b", 99]]));
      lateScripts.resolve(new Map([["topic-b", "Late user 2 script"]]));
      await Promise.all([
        lateRecords.promise,
        lateCounts.promise,
        lateScripts.promise,
      ]);
    });
    await flushAsyncWork();

    expect(hook().records.map((record) => record.userId)).toEqual(["user-3"]);
    expect([...hook().topicCounts]).toEqual([["topic-c", 3]]);
    expect([...hook().topicScripts]).toEqual([
      ["topic-c", "User 3 script"],
    ]);
  });

  it("retries cleanup only for the current account on login and online", async () => {
    mocks.retryPracticeAudioCleanupQueue.mockClear();

    act(() => window.dispatchEvent(new Event("online")));
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenCalledTimes(1);
    const user1Options = mocks.retryPracticeAudioCleanupQueue.mock.calls[0][1];
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ isOwnerActive: expect.any(Function) }),
    );
    expect(user1Options.isOwnerActive()).toBe(true);

    mocks.retryPracticeAudioCleanupQueue.mockClear();
    mocks.useAuth.mockReturnValue({ user: { uid: "user-2" } });
    await act(async () => {
      root?.render(<Probe />);
    });
    await flushAsyncWork();

    expect(user1Options.isOwnerActive()).toBe(false);
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenCalledTimes(1);
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenLastCalledWith(
      "user-2",
      expect.objectContaining({ isOwnerActive: expect.any(Function) }),
    );

    mocks.retryPracticeAudioCleanupQueue.mockClear();
    act(() => window.dispatchEvent(new Event("online")));
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenCalledTimes(1);
    expect(mocks.retryPracticeAudioCleanupQueue).toHaveBeenCalledWith(
      "user-2",
      expect.any(Object),
    );
  });

  it("revokes cleanup ownership when the Speech page unmounts", () => {
    mocks.retryPracticeAudioCleanupQueue.mockClear();
    act(() => window.dispatchEvent(new Event("online")));
    const options = mocks.retryPracticeAudioCleanupQueue.mock.calls[0][1];
    expect(options.isOwnerActive()).toBe(true);

    act(() => root?.unmount());
    root = null;

    expect(options.isOwnerActive()).toBe(false);
  });
});
