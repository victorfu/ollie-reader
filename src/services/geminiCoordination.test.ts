import { describe, expect, it, vi } from "vitest";
import {
  GeminiCrossTabGate,
  type GeminiGateLockManager,
} from "./geminiCrossTabGate";
import { GeminiRateLimitError } from "./geminiErrorPolicy";
import { GeminiRequestQueue } from "./geminiRequestQueue";

class MemoryStorage {
  private readonly values = new Map<string, string>();

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

interface PendingLock {
  mode: LockMode;
  callback: (lock: Lock | null) => Promise<unknown> | unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface LockState {
  activeShared: number;
  activeExclusive: boolean;
  pending: PendingLock[];
}

class FairLockManager implements GeminiGateLockManager {
  private readonly states = new Map<string, LockState>();

  private state(name: string): LockState {
    const existing = this.states.get(name);
    if (existing) return existing;
    const created = {
      activeShared: 0,
      activeExclusive: false,
      pending: [],
    };
    this.states.set(name, created);
    return created;
  }

  request<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(options.signal.reason);
        return;
      }

      const state = this.state(name);
      const entry: PendingLock = {
        mode: options.mode ?? "exclusive",
        callback,
        resolve: resolve as (value: unknown) => void,
        reject,
        signal: options.signal,
      };
      entry.onAbort = () => {
        const index = state.pending.indexOf(entry);
        if (index < 0) return;
        state.pending.splice(index, 1);
        reject(entry.signal?.reason);
        this.drain(name);
      };
      entry.signal?.addEventListener("abort", entry.onAbort, { once: true });
      state.pending.push(entry);
      this.drain(name);
    });
  }

  private drain(name: string): void {
    const state = this.state(name);
    if (state.activeExclusive || state.pending.length === 0) return;

    const first = state.pending[0];
    if (first.mode === "exclusive") {
      if (state.activeShared > 0) return;
      state.pending.shift();
      state.activeExclusive = true;
      this.grant(name, first);
      return;
    }

    while (
      !state.activeExclusive &&
      state.pending[0]?.mode === "shared"
    ) {
      const shared = state.pending.shift();
      if (!shared) break;
      state.activeShared += 1;
      this.grant(name, shared);
    }
  }

  private grant(name: string, entry: PendingLock): void {
    entry.signal?.removeEventListener("abort", entry.onAbort!);
    void (async () => {
      try {
        const value = await entry.callback({ name, mode: entry.mode } as Lock);
        entry.resolve(value);
      } catch (error) {
        entry.reject(error);
      } finally {
        const state = this.state(name);
        if (entry.mode === "exclusive") {
          state.activeExclusive = false;
        } else {
          state.activeShared -= 1;
        }
        this.drain(name);
      }
    })();
  }
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

const dailyError = {
  customErrorData: {
    status: 429,
    errorDetails: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaId: "GenerateRequestsPerDayPerProjectPerModel",
            quotaValue: "20",
          },
        ],
      },
    ],
  },
};

describe("Gemini cross-tab queue coordination", () => {
  it("blocks a tab already waiting for the provider lock after a daily 429", async () => {
    const storage = new MemoryStorage();
    const lockManager = new FairLockManager();
    const firstQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 0,
      storage,
    });
    const secondQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 0,
      storage,
    });
    const firstGate = new GeminiCrossTabGate({ storage, lockManager });
    const secondGate = new GeminiCrossTabGate({ storage, lockManager });
    const releaseFirstProvider = deferred();
    const firstProviderStarted = deferred();
    const secondProvider = vi.fn(async () => "unexpected");
    const quotaKey = "project:model";

    const runThroughClientBoundary = <T>(
      queue: GeminiRequestQueue,
      gate: GeminiCrossTabGate,
      provider: (signal: AbortSignal) => Promise<T>,
    ) =>
      queue.run(
        (signal) =>
          gate.run(
            async (providerSignal) => {
              try {
                return await provider(providerSignal);
              } catch (error) {
                const observation = queue.observeProviderError(error, quotaKey);
                if (observation && !observation.crossTabStatePersisted) {
                  gate.blockProviderUntil(observation.blockUntil);
                }
                throw error;
              }
            },
            {
              signal,
              minIntervalMs: 0,
              beforeStart: (providerSignal) =>
                queue.waitForSharedAvailability(quotaKey, providerSignal),
            },
          ),
        { action: "test", quotaKey },
      );

    const first = runThroughClientBoundary(firstQueue, firstGate, async () => {
      firstProviderStarted.resolve();
      await releaseFirstProvider.promise;
      throw dailyError;
    });
    await firstProviderStarted.promise;

    const second = runThroughClientBoundary(
      secondQueue,
      secondGate,
      secondProvider,
    );
    const settled = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(secondProvider).not.toHaveBeenCalled();

    releaseFirstProvider.resolve();
    const results = await settled;

    expect(results).toHaveLength(2);
    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    for (const result of results) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        GeminiRateLimitError,
      );
      expect((result as PromiseRejectedResult).reason).toMatchObject({
        decision: { kind: "daily_exhausted", retryable: false },
      });
    }
    expect(secondProvider).not.toHaveBeenCalled();
  });

  it("holds a Web Lock barrier when a daily breaker cannot be persisted", async () => {
    let currentTime = Date.parse("2026-08-12T12:00:00Z");
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage write unavailable");
      },
      removeItem: () => undefined,
    };
    const lockManager = new FairLockManager();
    let barrierDelay = 0;
    const barrierWake = deferred();
    const sleep = vi.fn(async (delayMs: number, signal: AbortSignal) => {
      if (signal.aborted) throw signal.reason;
      if (delayMs <= 0) return;
      barrierDelay = delayMs;
      await barrierWake.promise;
    });
    const firstQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 0,
      now: () => currentTime,
      storage,
    });
    const secondQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 0,
      now: () => currentTime,
      storage,
    });
    const firstGate = new GeminiCrossTabGate({
      now: () => currentTime,
      sleep,
      storage,
      lockManager,
    });
    const secondGate = new GeminiCrossTabGate({
      now: () => currentTime,
      sleep,
      storage,
      lockManager,
    });
    const firstProviderStarted = deferred();
    const releaseFirstProvider = deferred();
    const secondProvider = vi.fn(async () => "after-reset");
    const quotaKey = "project:model";

    const runThroughClientBoundary = <T>(
      queue: GeminiRequestQueue,
      gate: GeminiCrossTabGate,
      provider: (signal: AbortSignal) => Promise<T>,
    ) =>
      queue.run(
        (signal) =>
          gate.run(
            async (providerSignal) => {
              try {
                return await provider(providerSignal);
              } catch (error) {
                const observation = queue.observeProviderError(error, quotaKey);
                if (observation && !observation.crossTabStatePersisted) {
                  expect(gate.blockProviderUntil(observation.blockUntil)).toBe(
                    true,
                  );
                }
                throw error;
              }
            },
            {
              signal,
              minIntervalMs: 0,
              beforeStart: (providerSignal) =>
                queue.waitForSharedAvailability(quotaKey, providerSignal),
            },
          ),
        { action: "test", quotaKey },
      );

    const first = runThroughClientBoundary(firstQueue, firstGate, async () => {
      firstProviderStarted.resolve();
      await releaseFirstProvider.promise;
      throw dailyError;
    });
    await firstProviderStarted.promise;
    const second = runThroughClientBoundary(
      secondQueue,
      secondGate,
      secondProvider,
    );
    const firstSettled = Promise.allSettled([first]);
    releaseFirstProvider.resolve();

    await vi.waitFor(() => expect(barrierDelay).toBeGreaterThan(0));
    await firstSettled;
    expect(secondProvider).not.toHaveBeenCalled();

    currentTime += barrierDelay;
    barrierWake.resolve();
    await expect(second).resolves.toBe("after-reset");
    expect(secondProvider).toHaveBeenCalledOnce();
  });

  it("fails closed when persisted breaker state cannot be read", async () => {
    const storage = {
      getItem: () => {
        throw new Error("storage read unavailable");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    const provider = vi.fn(async () => "unexpected");

    await expect(
      queue.run(provider, { action: "test", quotaKey: "project:model" }),
    ).rejects.toMatchObject({
      decision: { kind: "unknown_429", retryable: false },
    });
    expect(provider).not.toHaveBeenCalled();
  });
});
