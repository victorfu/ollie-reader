const AUDIO_PATH_LOCK_PREFIX = "ollie-audio-path:";

export interface AudioUploadOperationLease {
  /** False means Web Locks are unavailable; callers may use an in-page guard. */
  crossTabProtected: boolean;
  release: () => void;
}

export type AudioUploadCleanupLockResult =
  | "completed"
  | "busy"
  | "unsupported";

function defaultLockManager(): LockManager | null {
  if (typeof navigator === "undefined") return null;
  return navigator.locks ?? null;
}

function lockName(audioPath: string): string {
  return `${AUDIO_PATH_LOCK_PREFIX}${audioPath}`;
}

/** Hold one path from before Storage upload until metadata outcome is settled. */
export function acquireAudioUploadOperationLock(
  audioPath: string,
  lockManager: LockManager | null = defaultLockManager(),
): Promise<AudioUploadOperationLease | null> {
  if (!lockManager) {
    return Promise.resolve({
      crossTabProtected: false,
      release: () => undefined,
    });
  }

  return new Promise<AudioUploadOperationLease | null>((resolve, reject) => {
    let settled = false;
    let releaseLock: (() => void) | null = null;
    const held = new Promise<void>((release) => {
      releaseLock = release;
    });

    void lockManager
      .request(
        lockName(audioPath),
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) {
            settled = true;
            resolve(null);
            return;
          }

          let released = false;
          settled = true;
          resolve({
            crossTabProtected: true,
            release: () => {
              if (released) return;
              released = true;
              releaseLock?.();
            },
          });
          await held;
        },
      )
      .catch((error: unknown) => {
        if (!settled) reject(error);
      });
  });
}

/** Run destructive reconciliation only when no live upload owns this path. */
export async function runWithAudioUploadCleanupLock(
  audioPath: string,
  cleanup: () => Promise<void>,
  lockManager: LockManager | null = defaultLockManager(),
): Promise<AudioUploadCleanupLockResult> {
  if (!lockManager) return "unsupported";

  return lockManager.request(
    lockName(audioPath),
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) return "busy";
      await cleanup();
      return "completed";
    },
  );
}
