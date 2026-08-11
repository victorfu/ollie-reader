import { describe, expect, it } from "vitest";
import {
  acquireAudioUploadOperationLock,
  runWithAudioUploadCleanupLock,
} from "./audioUploadOperationLock";

class FakeLockManager {
  private readonly held = new Set<string>();

  request<T>(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>,
  ): Promise<T> {
    if (this.held.has(name)) return Promise.resolve(callback(null));
    this.held.add(name);
    return Promise.resolve(
      callback({ name, mode: "exclusive" } as Lock),
    ).finally(() => this.held.delete(name));
  }
}

describe("audio upload operation locks", () => {
  it("blocks cleanup until the live upload releases its path", async () => {
    const locks = new FakeLockManager() as unknown as LockManager;
    const path = "audio-uploads/user-1/active.mp3";
    const lease = await acquireAudioUploadOperationLock(path, locks);

    expect(lease?.crossTabProtected).toBe(true);
    await expect(
      runWithAudioUploadCleanupLock(path, async () => undefined, locks),
    ).resolves.toBe("busy");

    lease?.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      runWithAudioUploadCleanupLock(path, async () => undefined, locks),
    ).resolves.toBe("completed");
  });

  it("uses a conservative unsupported result when Web Locks are absent", async () => {
    const path = "audio-uploads/user-1/fallback.mp3";
    const lease = await acquireAudioUploadOperationLock(path, null);

    expect(lease?.crossTabProtected).toBe(false);
    await expect(
      runWithAudioUploadCleanupLock(path, async () => undefined, null),
    ).resolves.toBe("unsupported");
  });
});
