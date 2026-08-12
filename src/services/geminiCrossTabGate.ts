import { logger } from "../utils/logger";

const GEMINI_PROVIDER_LOCK_NAME = "ollie-gemini-provider-v1";
const GEMINI_QUOTA_BARRIER_LOCK_NAME = "ollie-gemini-quota-barrier-v1";
const GEMINI_LAST_STARTED_AT_KEY = "ollie-gemini-last-started-at-v1";

type GateStorage = Pick<Storage, "getItem" | "setItem">;

export interface GeminiGateLockManager {
  request<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T>;
}

export interface GeminiCrossTabGateDependencies {
  now?: () => number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  storage?: GateStorage | null;
  lockManager?: GeminiGateLockManager | null;
}

export interface GeminiCrossTabGateRunOptions {
  signal?: AbortSignal;
  minIntervalMs: number | (() => number);
  beforeStart?: (signal: AbortSignal) => Promise<void>;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function defaultSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }

    const onAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(abortReason(signal));
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function defaultStorage(): GateStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultLockManager(): GeminiGateLockManager | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return navigator.locks;
}

function normalizeInterval(minIntervalMs: number): number {
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
    throw new RangeError("Gemini minimum request interval must be non-negative");
  }
  return Math.ceil(minIntervalMs);
}

function intervalResolver(
  configured: number | (() => number),
): () => number {
  if (typeof configured === "number") {
    const normalized = normalizeInterval(configured);
    return () => normalized;
  }
  return () => normalizeInterval(configured());
}

/**
 * Serializes provider calls across same-origin tabs and spaces their start
 * times. The Web Lock remains held until the provider promise settles.
 */
export class GeminiCrossTabGate {
  private readonly now: () => number;
  private readonly sleep: (
    delayMs: number,
    signal: AbortSignal,
  ) => Promise<void>;
  private readonly storage: GateStorage | null;
  private readonly lockManager: GeminiGateLockManager | null;
  private localTail: Promise<void> = Promise.resolve();
  private localLastStartedAt: number | null = null;

  constructor(dependencies: GeminiCrossTabGateDependencies = {}) {
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.storage = "storage" in dependencies
      ? dependencies.storage ?? null
      : defaultStorage();
    this.lockManager = "lockManager" in dependencies
      ? dependencies.lockManager ?? null
      : defaultLockManager();
  }

  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: GeminiCrossTabGateRunOptions,
  ): Promise<T> {
    const getMinIntervalMs = intervalResolver(options.minIntervalMs);
    const signal = options.signal ?? new AbortController().signal;
    throwIfAborted(signal);

    if (!this.lockManager) {
      return this.runWithLocalGate(
        operation,
        signal,
        getMinIntervalMs,
        options.beforeStart,
      );
    }

    const lockOptions: LockOptions = {
      mode: "exclusive",
      ...(options.signal ? { signal } : {}),
    };
    return this.lockManager.request(
      GEMINI_PROVIDER_LOCK_NAME,
      lockOptions,
      async (lock) => {
        if (!lock) throw new Error("Gemini provider Web Lock was not acquired");
        return this.lockManager!.request(
          GEMINI_QUOTA_BARRIER_LOCK_NAME,
          {
            mode: "shared",
            ...(options.signal ? { signal } : {}),
          },
          async (barrierLock) => {
            if (!barrierLock) {
              throw new Error("Gemini quota barrier Web Lock was not acquired");
            }
            return this.runWithCrossTabTimestamp(
              operation,
              signal,
              getMinIntervalMs,
              options.beforeStart,
            );
          },
        );
      },
    );
  }

  /**
   * Installs a same-origin fail-closed barrier when persistent cross-tab state
   * is unavailable. Call while the current request still owns the shared
   * barrier; the queued exclusive lock then precedes every later provider.
   */
  blockProviderUntil(until: number): boolean {
    if (!this.lockManager || !Number.isFinite(until) || until <= this.now()) {
      return false;
    }

    try {
      const holdSignal = new AbortController().signal;
      void this.lockManager
        .request(
          GEMINI_QUOTA_BARRIER_LOCK_NAME,
          { mode: "exclusive" },
          async (lock) => {
            if (!lock) return;
            while (true) {
              const remaining = until - this.now();
              if (remaining <= 0) return;
              await this.sleep(remaining, holdSignal);
            }
          },
        )
        .catch((error: unknown) => {
          logger.error("Gemini fail-closed quota barrier failed", error);
        });
      return true;
    } catch (error) {
      logger.error("Failed to install the Gemini quota barrier", error);
      return false;
    }
  }

  private async waitForStartWindow(
    lastStartedAt: number,
    getMinIntervalMs: () => number,
    signal: AbortSignal,
  ): Promise<void> {
    while (true) {
      throwIfAborted(signal);
      const minIntervalMs = getMinIntervalMs();
      const remainingMs = lastStartedAt + minIntervalMs - this.now();
      if (remainingMs <= 0) return;
      await this.sleep(remainingMs, signal);
      // Background tabs may wake early or late. Re-read the clock instead of
      // assuming the requested timeout elapsed exactly.
    }
  }

  private readLastStartedAt(): {
    reliable: boolean;
    value: number | null;
  } {
    if (!this.storage) return { reliable: false, value: null };
    try {
      const stored = this.storage.getItem(GEMINI_LAST_STARTED_AT_KEY);
      if (stored === null) return { reliable: true, value: null };
      const value = Number(stored);
      if (!Number.isFinite(value) || value < 0) {
        return { reliable: false, value: null };
      }
      return { reliable: true, value };
    } catch {
      return { reliable: false, value: null };
    }
  }

  private async runWithCrossTabTimestamp<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    getMinIntervalMs: () => number,
    beforeStart?: (signal: AbortSignal) => Promise<void>,
  ): Promise<T> {
    await beforeStart?.(signal);
    throwIfAborted(signal);

    const lockAcquiredAt = this.now();
    const stored = this.readLastStartedAt();

    if (stored.reliable) {
      if (stored.value !== null) {
        await this.waitForStartWindow(stored.value, getMinIntervalMs, signal);
      }
    } else {
      // Without a trustworthy shared timestamp, wait a complete interval while
      // holding the lock so a prior tab cannot have started too recently.
      await this.waitForStartWindow(
        lockAcquiredAt,
        getMinIntervalMs,
        signal,
      );
    }

    throwIfAborted(signal);
    let startedAt = this.now();
    let timestampPersisted = false;
    try {
      if (!this.storage) throw new Error("Gemini gate storage is unavailable");
      this.storage.setItem(GEMINI_LAST_STARTED_AT_KEY, String(startedAt));
      timestampPersisted = true;
    } catch {
      // A successful read followed by a failed write is also untrustworthy.
      // Delay this start by a full interval before proceeding conservatively.
      if (stored.reliable) {
        await this.waitForStartWindow(
          startedAt,
          getMinIntervalMs,
          signal,
        );
        startedAt = this.now();
      }

      // Storage may have failed transiently. Persist the adjusted start before
      // invoking the provider so the next tab sees the correct pacing window.
      try {
        if (!this.storage) throw new Error("Gemini gate storage is unavailable");
        this.storage.setItem(GEMINI_LAST_STARTED_AT_KEY, String(startedAt));
        timestampPersisted = true;
      } catch {
        // If sharing remains unavailable, holding the Web Lock through the
        // full start window below preserves spacing for the next lock holder.
      }
    }

    this.localLastStartedAt = startedAt;
    throwIfAborted(signal);
    try {
      return await operation(signal);
    } finally {
      if (!timestampPersisted) {
        // Do not let caller cancellation release the lock early. The provider
        // start still consumes quota even when its result is no longer needed.
        await this.waitForStartWindow(
          startedAt,
          getMinIntervalMs,
          new AbortController().signal,
        );
      }
    }
  }

  private runWithLocalGate<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    getMinIntervalMs: () => number,
    beforeStart?: (signal: AbortSignal) => Promise<void>,
  ): Promise<T> {
    const predecessor = this.localTail;
    let releaseTurn: () => void = () => undefined;
    this.localTail = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });

    return (async () => {
      await predecessor;
      try {
        throwIfAborted(signal);
        await beforeStart?.(signal);
        throwIfAborted(signal);
        if (this.localLastStartedAt !== null) {
          await this.waitForStartWindow(
            this.localLastStartedAt,
            getMinIntervalMs,
            signal,
          );
        }
        throwIfAborted(signal);
        this.localLastStartedAt = this.now();
        return await operation(signal);
      } finally {
        releaseTurn();
      }
    })();
  }
}

export const geminiCrossTabGate = new GeminiCrossTabGate();
