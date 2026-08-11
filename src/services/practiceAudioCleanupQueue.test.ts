import { describe, expect, it, vi } from "vitest";
import {
  enqueuePracticeAudioCleanup,
  readPracticeAudioCleanupQueue,
  removePracticeAudioCleanup,
  retryPracticeAudioCleanupQueue,
  type PendingPracticeAudioCleanup,
} from "./practiceAudioCleanupQueue";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const cleanup: PendingPracticeAudioCleanup = {
  userId: "user-a",
  recordId: "record-1",
  path: "speech-practice/user-a/record-1.mp4",
  reason: "orphaned-upload",
  operationId: "upload-op-1",
  leaseExpiresAt: 0,
};

const withAcquiredWebLock = async <T,>(
  _cleanup: PendingPracticeAudioCleanup,
  work: (usedWebLock: boolean) => Promise<T>,
) => ({
  acquired: true,
  usedWebLock: true,
  value: await work(true),
});

describe("practiceAudioCleanupQueue", () => {
  it("keeps a failed cleanup marker and removes it only after success", async () => {
    const storage = new MemoryStorage();
    const resolveCleanup = vi.fn().mockResolvedValue("deletable");
    const deleteAudio = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    expect(enqueuePracticeAudioCleanup(cleanup, storage)).toBe(true);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(1);
    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(0);

    expect(deleteAudio).toHaveBeenCalledTimes(2);
    expect(readPracticeAudioCleanupQueue("user-a", storage)).toEqual([]);
  });

  it("removes a referenced marker without deleting its audio", async () => {
    const storage = new MemoryStorage();
    const deleteAudio = vi.fn();
    const resolveCleanup = vi.fn().mockResolvedValue("referenced");
    enqueuePracticeAudioCleanup(cleanup, storage);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(0);

    expect(resolveCleanup).toHaveBeenCalledWith(cleanup);
    expect(deleteAudio).not.toHaveBeenCalled();
  });

  it("keeps deferred and ambiguous markers without deleting", async () => {
    const storage = new MemoryStorage();
    const deleteAudio = vi.fn();
    enqueuePracticeAudioCleanup(cleanup, storage);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup: vi.fn().mockResolvedValue("defer"),
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(1);
    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup: vi.fn().mockRejectedValue(new Error("offline")),
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(1);

    expect(deleteAudio).not.toHaveBeenCalled();
  });

  it("keeps even an expired marker when Web Locks are unavailable", async () => {
    const storage = new MemoryStorage();
    const liveCleanup = { ...cleanup, leaseExpiresAt: 0 };
    const resolveCleanup = vi.fn().mockResolvedValue("deletable");
    const deleteAudio = vi.fn();
    enqueuePracticeAudioCleanup(liveCleanup, storage);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: async (_cleanup, work) => ({
        acquired: true,
        usedWebLock: false,
        value: await work(false),
      }),
    })).resolves.toBe(1);

    expect(resolveCleanup).not.toHaveBeenCalled();
    expect(deleteAudio).not.toHaveBeenCalled();
  });

  it("defers cleanup while another tab holds the per-path Web Lock", async () => {
    const storage = new MemoryStorage();
    const resolveCleanup = vi.fn();
    const deleteAudio = vi.fn();
    enqueuePracticeAudioCleanup(cleanup, storage);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: vi.fn().mockResolvedValue({
        acquired: false,
        usedWebLock: true,
      }),
    })).resolves.toBe(1);

    expect(resolveCleanup).not.toHaveBeenCalled();
    expect(deleteAudio).not.toHaveBeenCalled();
  });

  it("ignores a stale lease after a crashed tab releases its Web Lock", async () => {
    const storage = new MemoryStorage();
    const staleLease = { ...cleanup, leaseExpiresAt: Number.MAX_SAFE_INTEGER };
    const resolveCleanup = vi.fn().mockResolvedValue("deletable");
    const deleteAudio = vi.fn().mockResolvedValue(undefined);
    enqueuePracticeAudioCleanup(staleLease, storage);

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      runWithLock: async (_cleanup, work) => ({
        acquired: true,
        usedWebLock: true,
        value: await work(true),
      }),
    })).resolves.toBe(0);

    expect(resolveCleanup).toHaveBeenCalledWith(staleLease);
    expect(deleteAudio).toHaveBeenCalledOnce();
  });

  it("never uses account B or an inactive owner to clean account A", async () => {
    const storage = new MemoryStorage();
    const deleteAudio = vi.fn();
    enqueuePracticeAudioCleanup(cleanup, storage);

    await expect(retryPracticeAudioCleanupQueue("user-b", {
      storage,
      deleteAudio,
      resolveCleanup: vi.fn().mockResolvedValue("deletable"),
    })).resolves.toBe(0);
    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup: vi.fn().mockResolvedValue("deletable"),
      isOwnerActive: () => false,
    })).resolves.toBe(1);

    expect(deleteAudio).not.toHaveBeenCalled();
    expect(readPracticeAudioCleanupQueue("user-a", storage)).toEqual([
      cleanup,
    ]);
  });

  it("rechecks ownership after a pending transactional resolution", async () => {
    const storage = new MemoryStorage();
    const deleteAudio = vi.fn();
    let ownerActive = true;
    let resolveStatus!: (status: "deletable") => void;
    const resolveCleanup = vi.fn(() => new Promise<"deletable">((resolve) => {
      resolveStatus = resolve;
    }));
    enqueuePracticeAudioCleanup(cleanup, storage);

    const retry = retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup,
      isOwnerActive: () => ownerActive,
      runWithLock: withAcquiredWebLock,
    });
    await Promise.resolve();
    ownerActive = false;
    resolveStatus("deletable");
    await expect(retry).resolves.toBe(1);

    expect(deleteAudio).not.toHaveBeenCalled();
  });

  it("lets a new same-owner mount retry while an old cancelled run settles", async () => {
    const storage = new MemoryStorage();
    const deleteAudio = vi.fn().mockResolvedValue(undefined);
    let oldOwnerActive = true;
    let resolveOld!: (status: "deletable") => void;
    enqueuePracticeAudioCleanup(cleanup, storage);

    const oldRun = retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup: () => new Promise<"deletable">((resolve) => {
        resolveOld = resolve;
      }),
      isOwnerActive: () => oldOwnerActive,
      runWithLock: withAcquiredWebLock,
    });
    await Promise.resolve();
    oldOwnerActive = false;

    await expect(retryPracticeAudioCleanupQueue("user-a", {
      storage,
      deleteAudio,
      resolveCleanup: vi.fn().mockResolvedValue("deletable"),
      runWithLock: withAcquiredWebLock,
    })).resolves.toBe(0);
    resolveOld("deletable");
    await expect(oldRun).resolves.toBe(0);

    expect(deleteAudio).toHaveBeenCalledOnce();
  });

  it("does not let an old marker remove a newer operation marker", () => {
    const storage = new MemoryStorage();
    const newer: PendingPracticeAudioCleanup = {
      ...cleanup,
      reason: "deleted-record",
      operationId: "delete-op-2",
    };
    enqueuePracticeAudioCleanup(cleanup, storage);
    enqueuePracticeAudioCleanup(newer, storage);

    expect(removePracticeAudioCleanup(cleanup, storage)).toBe(true);
    expect(readPracticeAudioCleanupQueue("user-a", storage)).toEqual([newer]);
  });

  it("rejects a tampered path instead of queueing arbitrary deletion", () => {
    const storage = new MemoryStorage();
    expect(enqueuePracticeAudioCleanup({
      ...cleanup,
      path: "speech-practice/user-a/record-1.mp4/../../user-b/file.mp4",
    }, storage)).toBe(false);
    expect(readPracticeAudioCleanupQueue("user-a", storage)).toEqual([]);
  });
});
