import { deletePracticeAudio } from "./audioStorageService";

const CLEANUP_KEY_PREFIX = "ollie-practice-audio-cleanup-v1:";

export interface PendingPracticeAudioCleanup {
  userId: string;
  recordId: string;
  path: string;
  reason: "orphaned-upload" | "deleted-record";
  /** Unique Firestore operation token; also makes each local marker immutable. */
  operationId: string;
  /**
   * A renewable lease held only while the matching Storage upload request is
   * alive. Cleanup never cancels/deletes an operation before this time.
   */
  leaseExpiresAt: number;
}

export type PracticeAudioCleanupResolution =
  | "referenced"
  | "deletable"
  | "defer";

type ResolvePracticeAudioCleanup = (
  cleanup: PendingPracticeAudioCleanup,
) => Promise<PracticeAudioCleanupResolution>;

type CleanupStorage = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;

const SAFE_AUDIO_EXTENSIONS = new Set(["webm", "mp4", "ogg", "mp3", "wav"]);

function defaultStorage(): CleanupStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cleanupKey(
  userId: string,
  recordId: string,
  operationId: string,
): string {
  return [
    CLEANUP_KEY_PREFIX,
    encodeURIComponent(userId),
    ":",
    encodeURIComponent(recordId),
    ":",
    encodeURIComponent(operationId),
  ].join("");
}

function cleanupKeyPrefix(userId: string): string {
  return `${CLEANUP_KEY_PREFIX}${encodeURIComponent(userId)}:`;
}

function operationLockName(cleanup: PendingPracticeAudioCleanup): string {
  // The path is deterministic for a record, so all tabs and all operation
  // tokens that may mutate the same object serialize on one lock.
  return `ollie-practice-audio:${cleanup.path}`;
}

export interface PracticeAudioOperationLockResult<T> {
  acquired: boolean;
  usedWebLock: boolean;
  value?: T;
}

/**
 * Serialize an uploader and cleanup across same-origin tabs. Web Locks are
 * released automatically if a tab crashes. Browsers without Web Locks run the
 * callback directly and rely on the marker's renewable lease instead.
 */
export async function runWithPracticeAudioOperationLock<T>(
  cleanup: PendingPracticeAudioCleanup,
  work: (usedWebLock: boolean) => Promise<T>,
  options: { ifAvailable?: boolean } = {},
): Promise<PracticeAudioOperationLockResult<T>> {
  const lockManager = typeof navigator !== "undefined"
    ? navigator.locks
    : undefined;
  if (!lockManager) {
    return {
      acquired: true,
      usedWebLock: false,
      value: await work(false),
    };
  }

  const requestOptions: LockOptions = {
    mode: "exclusive",
    ...(options.ifAvailable ? { ifAvailable: true } : {}),
  };
  return lockManager.request(
    operationLockName(cleanup),
    requestOptions,
    async (lock) => {
      if (!lock) return { acquired: false, usedWebLock: true };
      return {
        acquired: true,
        usedWebLock: true,
        value: await work(true),
      };
    },
  );
}

function isValidCleanup(
  value: unknown,
  expectedUserId: string,
): value is PendingPracticeAudioCleanup {
  if (!value || typeof value !== "object") return false;
  const cleanup = value as Record<string, unknown>;
  if (
    cleanup.userId !== expectedUserId
    || typeof cleanup.recordId !== "string"
    || cleanup.recordId.length === 0
    || cleanup.recordId.includes("/")
    || typeof cleanup.path !== "string"
    || typeof cleanup.operationId !== "string"
    || cleanup.operationId.length === 0
    || cleanup.operationId.length > 128
    || cleanup.operationId.includes("/")
    || typeof cleanup.leaseExpiresAt !== "number"
    || !Number.isFinite(cleanup.leaseExpiresAt)
    || cleanup.leaseExpiresAt < 0
    || (
      cleanup.reason !== "orphaned-upload"
      && cleanup.reason !== "deleted-record"
    )
  ) return false;

  const expectedPrefix = `speech-practice/${expectedUserId}/${cleanup.recordId}.`;
  const extension = cleanup.path.slice(expectedPrefix.length);
  return (
    cleanup.path.startsWith(expectedPrefix)
    && SAFE_AUDIO_EXTENSIONS.has(extension)
  );
}

/**
 * Persist one orphaned upload independently so concurrent tabs cannot lose
 * another record through a shared read-modify-write array.
 */
export function enqueuePracticeAudioCleanup(
  cleanup: PendingPracticeAudioCleanup,
  storage: CleanupStorage | null = defaultStorage(),
): boolean {
  if (!storage || !isValidCleanup(cleanup, cleanup.userId)) return false;
  try {
    storage.setItem(
      cleanupKey(cleanup.userId, cleanup.recordId, cleanup.operationId),
      JSON.stringify(cleanup),
    );
    return true;
  } catch {
    return false;
  }
}

export function removePracticeAudioCleanup(
  cleanup: PendingPracticeAudioCleanup,
  storage: CleanupStorage | null = defaultStorage(),
): boolean {
  if (!storage || !isValidCleanup(cleanup, cleanup.userId)) return false;
  try {
    storage.removeItem(
      cleanupKey(cleanup.userId, cleanup.recordId, cleanup.operationId),
    );
    return true;
  } catch {
    return false;
  }
}

export function readPracticeAudioCleanupQueue(
  userId: string,
  storage: CleanupStorage | null = defaultStorage(),
): PendingPracticeAudioCleanup[] {
  if (!storage || !userId) return [];

  const prefix = cleanupKeyPrefix(userId);
  const cleanups: PendingPracticeAudioCleanup[] = [];
  const invalidKeys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        const parsed = JSON.parse(storage.getItem(key) ?? "null");
        if (isValidCleanup(parsed, userId)) cleanups.push(parsed);
        else invalidKeys.push(key);
      } catch {
        invalidKeys.push(key);
      }
    }
    invalidKeys.forEach((key) => storage.removeItem(key));
  } catch {
    return [];
  }
  return cleanups;
}

/**
 * Retry only the selected owner's queue. A successful Storage deletion removes
 * that durable marker; failures remain for the next mount/online event.
 */
export function retryPracticeAudioCleanupQueue(
  userId: string,
  options: {
    storage?: CleanupStorage | null;
    deleteAudio?: typeof deletePracticeAudio;
    resolveCleanup: ResolvePracticeAudioCleanup;
    isOwnerActive?: () => boolean;
    shouldSkip?: (cleanup: PendingPracticeAudioCleanup) => boolean;
    runWithLock?: typeof runWithPracticeAudioOperationLock;
  },
): Promise<number> {
  if (!userId) return Promise.resolve(0);

  const storage = options.storage === undefined
    ? defaultStorage()
    : options.storage;
  const deleteAudio = options.deleteAudio ?? deletePracticeAudio;
  const resolveCleanup = options.resolveCleanup;
  const isOwnerActive = options.isOwnerActive ?? (() => true);
  const shouldSkip = options.shouldSkip ?? (() => false);
  const runWithLock = options.runWithLock
    ?? runWithPracticeAudioOperationLock;
  return (async () => {
    const pending = readPracticeAudioCleanupQueue(userId, storage);
    for (const cleanup of pending) {
      // Do not start an owner's Storage request after the active account has
      // changed. The marker remains for that owner to retry after logging in.
      if (!isOwnerActive()) break;
      try {
        const work = async (usedWebLock: boolean) => {
          if (!isOwnerActive() || shouldSkip(cleanup)) return;
          // Without a cross-tab fencing primitive, an expired lease cannot
          // prove that a suspended uploader will never resume. Preserve the
          // durable marker rather than cancelling its token or deleting audio.
          // The initiating tab can still reconcile its own completed request.
          if (!usedWebLock) {
            return;
          }

          const resolution = await resolveCleanup(cleanup);
          if (resolution === "referenced") {
            removePracticeAudioCleanup(cleanup, storage);
            return;
          }
          if (resolution === "defer") return;
          // The lookup may have started as A and completed after a switch to
          // B. Re-check before issuing the destructive Storage request.
          if (!isOwnerActive() || shouldSkip(cleanup)) return;
          await deleteAudio(userId, cleanup.recordId, cleanup.path);
          removePracticeAudioCleanup(cleanup, storage);
        };
        const immediate = await runWithLock(
          cleanup,
          work,
          { ifAvailable: true },
        );
        // Queue behind a live uploader/older cleanup after the non-blocking
        // probe. This keeps a new mount from missing its only retry, while the
        // callback still revalidates the active owner after the lock releases.
        if (!immediate.acquired && isOwnerActive()) {
          await runWithLock(cleanup, work);
        }
      } catch {
        // An ambiguous metadata lookup and a failed Storage delete are both
        // non-destructive: keep the marker for the next same-owner retry.
      }
    }
    return readPracticeAudioCleanupQueue(userId, storage).length;
  })();
}
