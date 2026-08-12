import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiRateLimitError } from "./geminiErrorPolicy";
import { GeminiRequestQueue } from "./geminiRequestQueue";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const quotaError = (
  quotaId: string,
  retryDelay?: string,
  quotaValue: string = "10",
) => ({
  customErrorData: {
    status: 429,
    errorDetails: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId, quotaValue }],
      },
      ...(retryDelay
        ? [
            {
              "@type": "type.googleapis.com/google.rpc.RetryInfo",
              retryDelay,
            },
          ]
        : []),
    ],
  },
});

const options = {
  action: "test",
  quotaKey: "project:model",
};

describe("GeminiRequestQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs only one provider operation at a time in FIFO order", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage: null,
    });
    let releaseFirst: ((value: string) => void) | undefined;
    const order: string[] = [];
    const first = queue.run(
      () =>
        new Promise<string>((resolve) => {
          order.push("first");
          releaseFirst = resolve;
        }),
      options,
    );
    const second = queue.run(async () => {
      order.push("second");
      return "two";
    }, options);

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["first"]);
    releaseFirst?.("one");
    await expect(first).resolves.toBe("one");
    await expect(second).resolves.toBe("two");
    expect(order).toEqual(["first", "second"]);
  });

  it("paces request start times without accumulating burst credit", async () => {
    const starts: number[] = [];
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 5_000,
      now: Date.now,
      storage: null,
    });
    const first = queue.run(async () => {
      starts.push(Date.now());
    }, options);
    const second = queue.run(async () => {
      starts.push(Date.now());
    }, options);

    await first;
    await vi.advanceTimersByTimeAsync(4_999);
    expect(starts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(starts[1] - starts[0]).toBe(5_000);
  });

  it("removes an aborted queued job without invoking it", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage: null,
    });
    let release: (() => void) | undefined;
    const first = queue.run(
      () => new Promise<void>((resolve) => (release = resolve)),
      options,
    );
    const controller = new AbortController();
    const operation = vi.fn(async () => undefined);
    const second = queue.run(operation, { ...options, signal: controller.signal });

    controller.abort();
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
    release?.();
    await first;
  });

  it("retries only a structured short-term limit after the pacing floor", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 1_000,
      baseBackoffMs: 10,
      random: () => 0,
      storage: null,
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        quotaError("GenerateRequestsPerMinutePerProjectPerModel", "0.1s"),
      )
      .mockResolvedValue("ok");
    const result = queue.run(operation, options);

    await vi.advanceTimersByTimeAsync(999);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops pending work after the bounded short-term retries are exhausted", async () => {
    const storage = new MemoryStorage();
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 100,
      baseBackoffMs: 10,
      maxRetries: 1,
      random: () => 0,
      storage,
    });
    const provider = vi.fn(async () => {
      throw quotaError("RPM", "0.01s");
    });
    const pendingProvider = vi.fn(async () => "unexpected");
    const first = queue.run(provider, options);
    const second = queue.run(pendingProvider, options);
    const settled = Promise.allSettled([first, second]);

    await vi.advanceTimersByTimeAsync(100);
    const results = await settled;

    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(pendingProvider).not.toHaveBeenCalled();
  });

  it("does not retry a daily quota and rejects already queued work", async () => {
    const storage = new MemoryStorage();
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    const provider = vi.fn(async () => {
      throw quotaError("GenerateRequestsPerDayPerProjectPerModel", "1s");
    });
    const first = queue.run(provider, options);
    const queuedProvider = vi.fn(async () => "should-not-run");
    const second = queue.run(queuedProvider, options);

    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    expect(firstResult.status).toBe("rejected");
    expect(secondResult.status).toBe("rejected");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(queuedProvider).not.toHaveBeenCalled();
    expect((firstResult as PromiseRejectedResult).reason).toBeInstanceOf(
      GeminiRateLimitError,
    );
  });

  it("persists a daily breaker until the Pacific calendar day changes", async () => {
    const storage = new MemoryStorage();
    const firstQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    await expect(
      firstQueue.run(
        async () => {
          throw quotaError("RPD");
        },
        options,
      ),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);

    const blocked = vi.fn(async () => "blocked");
    const secondQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    await expect(secondQueue.run(blocked, options)).rejects.toBeInstanceOf(
      GeminiRateLimitError,
    );
    expect(blocked).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
    await expect(secondQueue.run(blocked, options)).resolves.toBe("blocked");
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it("shares a provider-observed daily breaker before another queue can start", async () => {
    const storage = new MemoryStorage();
    const firstQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    const secondQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });

    firstQueue.observeProviderError(
      quotaError("GenerateRequestsPerDayPerProjectPerModel", "1s"),
      options.quotaKey,
    );

    const provider = vi.fn(async () => "unexpected");
    await expect(secondQueue.run(provider, options)).rejects.toBeInstanceOf(
      GeminiRateLimitError,
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it("shares a structured short-term cooldown across queue instances", async () => {
    const storage = new MemoryStorage();
    const firstQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 10,
      storage,
    });
    const secondQueue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      baseBackoffMs: 10,
      storage,
    });

    firstQueue.observeProviderError(
      quotaError("GenerateRequestsPerMinutePerProjectPerModel", "0.2s"),
      options.quotaKey,
    );

    const provider = vi.fn(async () => "ok");
    const result = secondQueue.run(provider, options);
    await vi.advanceTimersByTimeAsync(199);
    expect(provider).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("ok");
    expect(provider).toHaveBeenCalledOnce();
  });

  it("fails closed for an ambiguous 429 and does not retry", async () => {
    const storage = new MemoryStorage();
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage,
    });
    const operation = vi.fn(async () => {
      throw { customErrorData: { status: 429, errorDetails: [] } };
    });

    await expect(queue.run(operation, options)).rejects.toMatchObject({
      decision: { kind: "unknown_429", retryable: false },
    });
    expect(operation).toHaveBeenCalledTimes(1);
    await expect(queue.run(operation, options)).rejects.toBeInstanceOf(
      GeminiRateLimitError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("keeps the temporary breaker in memory when localStorage is unavailable", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage: null,
    });
    const operation = vi.fn(async () => {
      throw { customErrorData: { status: 429, errorDetails: [] } };
    });

    await expect(queue.run(operation, options)).rejects.toBeInstanceOf(
      GeminiRateLimitError,
    );
    await expect(queue.run(operation, options)).rejects.toBeInstanceOf(
      GeminiRateLimitError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry an aborted in-flight operation", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage: null,
    });
    const controller = new AbortController();
    const operation = vi.fn(
      (signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const result = queue.run(operation, { ...options, signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("rejects an active abort even if the provider later resolves normally", async () => {
    const queue = new GeminiRequestQueue({
      getMinimumStartIntervalMs: () => 0,
      storage: null,
    });
    const controller = new AbortController();
    let resolveProvider: (() => void) | undefined;
    const provider = vi.fn(
      () => new Promise<void>((resolve) => (resolveProvider = resolve)),
    );
    const nextProvider = vi.fn(async () => "next");
    const active = queue.run(provider, {
      ...options,
      signal: controller.signal,
    });
    const next = queue.run(nextProvider, options);
    await vi.advanceTimersByTimeAsync(0);

    controller.abort();
    expect(nextProvider).not.toHaveBeenCalled();
    resolveProvider?.();

    await expect(active).rejects.toMatchObject({ name: "AbortError" });
    await expect(next).resolves.toBe("next");
  });
});
