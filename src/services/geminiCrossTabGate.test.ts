import { describe, expect, it, vi } from "vitest";
import {
  GeminiCrossTabGate,
  type GeminiGateLockManager,
} from "./geminiCrossTabGate";

class ExclusiveLockManager implements GeminiGateLockManager {
  private readonly tails = new Map<string, Promise<void>>();
  readonly requests: Array<{ name: string; options: LockOptions }> = [];

  request<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> {
    this.requests.push({ name, options });
    const predecessor = this.tails.get(name) ?? Promise.resolve();
    let release: () => void = () => undefined;
    this.tails.set(name, new Promise<void>((resolve) => {
      release = resolve;
    }));

    return (async () => {
      await predecessor;
      try {
        if (options.signal?.aborted) {
          throw options.signal.reason;
        }
        return await callback({ name, mode: "exclusive" } as Lock);
      } finally {
        release();
      }
    })();
  }
}

function deferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function clock(start = 0) {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleeps,
    sleep: async (delayMs: number, signal: AbortSignal) => {
      if (signal.aborted) throw signal.reason;
      sleeps.push(delayMs);
      current += delayMs;
    },
    set: (value: number) => {
      current = value;
    },
  };
}

describe("GeminiCrossTabGate", () => {
  it("serializes separate instances and spaces provider starts through Web Locks", async () => {
    const time = clock(1_000);
    const storage = new Map<string, string>();
    const gateStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    const locks = new ExclusiveLockManager();
    const firstGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage: gateStorage,
      lockManager: locks,
    });
    const secondGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage: gateStorage,
      lockManager: locks,
    });
    const firstDone = deferred<string>();
    const starts: number[] = [];

    const first = firstGate.run(async () => {
      starts.push(time.now());
      return firstDone.promise;
    }, { minIntervalMs: 100 });
    const second = secondGate.run(async () => {
      starts.push(time.now());
      return "second";
    }, { minIntervalMs: 100 });

    await vi.waitFor(() => expect(starts).toEqual([1_000]));
    firstDone.resolve("first");

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(starts).toEqual([1_000, 1_100]);
    expect(time.sleeps).toEqual([100]);
    expect(
      locks.requests
        .map(({ name }) => name)
        .filter((name) => name === "ollie-gemini-provider-v1"),
    ).toEqual([
      "ollie-gemini-provider-v1",
      "ollie-gemini-provider-v1",
    ]);
  });

  it("passes the caller signal to a pending Web Lock request", async () => {
    const locks = new ExclusiveLockManager();
    const controller = new AbortController();
    const gate = new GeminiCrossTabGate({
      storage: { getItem: () => null, setItem: () => undefined },
      lockManager: locks,
    });

    await gate.run(async () => "ok", {
      signal: controller.signal,
      minIntervalMs: 0,
    });

    expect(locks.requests[0]?.options).toMatchObject({
      mode: "exclusive",
      signal: controller.signal,
    });
  });

  it("keeps the Web Lock until an abort-ignoring in-flight operation settles", async () => {
    const time = clock();
    const locks = new ExclusiveLockManager();
    const storage = { getItem: () => null, setItem: () => undefined };
    const firstGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const secondGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const controller = new AbortController();
    const firstDone = deferred<void>();
    const firstOperation = vi.fn(async () => firstDone.promise);
    const secondOperation = vi.fn(async () => "second");

    const first = firstGate.run(firstOperation, {
      signal: controller.signal,
      minIntervalMs: 0,
    });
    await vi.waitFor(() => expect(firstOperation).toHaveBeenCalledOnce());
    controller.abort();
    const second = secondGate.run(secondOperation, { minIntervalMs: 0 });
    await Promise.resolve();
    expect(secondOperation).not.toHaveBeenCalled();

    firstDone.resolve();
    await first;
    await expect(second).resolves.toBe("second");
    expect(secondOperation).toHaveBeenCalledOnce();
  });

  it("waits a full interval when shared storage cannot be read", async () => {
    const time = clock(500);
    const gate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage: {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
      },
      lockManager: new ExclusiveLockManager(),
    });
    const operation = vi.fn(async () => time.now());

    await expect(gate.run(operation, { minIntervalMs: 250 })).resolves.toBe(750);
    expect(time.sleeps).toEqual([250, 250]);
  });

  it("waits a full interval when a previously readable timestamp cannot be written", async () => {
    const time = clock(500);
    const gate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage: {
        getItem: () => null,
        setItem: () => { throw new Error("full"); },
      },
      lockManager: new ExclusiveLockManager(),
    });

    await expect(gate.run(async () => time.now(), {
      minIntervalMs: 250,
    })).resolves.toBe(750);
    expect(time.sleeps).toEqual([250, 250]);
  });

  it("retries a transient timestamp write before another tab starts", async () => {
    const time = clock(500);
    const values = new Map<string, string>();
    let writes = 0;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes += 1;
        if (writes === 1) throw new Error("transient");
        values.set(key, value);
      },
    };
    const locks = new ExclusiveLockManager();
    const firstGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const secondGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const starts: number[] = [];

    await firstGate.run(async () => {
      starts.push(time.now());
    }, { minIntervalMs: 250 });
    await secondGate.run(async () => {
      starts.push(time.now());
    }, { minIntervalMs: 250 });

    expect(starts).toEqual([750, 1_000]);
    expect(time.sleeps).toEqual([250, 250]);
  });

  it("resolves a dynamic interval only after acquiring the provider lock", async () => {
    const time = clock();
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const locks = new ExclusiveLockManager();
    const firstGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const secondGate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage,
      lockManager: locks,
    });
    const firstDone = deferred<void>();
    const starts: number[] = [];
    let currentInterval = 100;

    const first = firstGate.run(async () => {
      starts.push(time.now());
      return firstDone.promise;
    }, { minIntervalMs: 0 });
    const second = secondGate.run(async () => {
      starts.push(time.now());
    }, { minIntervalMs: () => currentInterval });

    await vi.waitFor(() => expect(starts).toEqual([0]));
    currentInterval = 400;
    firstDone.resolve();
    await first;
    await second;

    expect(starts).toEqual([0, 400]);
  });

  it("re-evaluates a dynamic interval after each pacing wake-up", async () => {
    let current = 0;
    let currentInterval = 100;
    const firstWake = deferred<void>();
    const sleeps: number[] = [];
    const sleep = vi.fn(async (delayMs: number, signal: AbortSignal) => {
      if (signal.aborted) throw signal.reason;
      sleeps.push(delayMs);
      if (sleeps.length === 1) {
        await firstWake.promise;
      } else {
        current += delayMs;
      }
    });
    const gate = new GeminiCrossTabGate({
      now: () => current,
      sleep,
      storage: {
        getItem: () => "0",
        setItem: () => undefined,
      },
      lockManager: new ExclusiveLockManager(),
    });
    const operation = vi.fn(async () => current);

    const result = gate.run(operation, {
      minIntervalMs: () => currentInterval,
    });
    await vi.waitFor(() => expect(sleeps).toEqual([100]));

    current = 100;
    currentInterval = 400;
    firstWake.resolve();

    await expect(result).resolves.toBe(400);
    expect(sleeps).toEqual([100, 300]);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rechecks the clock after a background timer wakes later than requested", async () => {
    let current = 1_000;
    const sleep = vi.fn(async (_delayMs: number, signal: AbortSignal) => {
      if (signal.aborted) throw signal.reason;
      current = 1_500;
    });
    const gate = new GeminiCrossTabGate({
      now: () => current,
      sleep,
      storage: {
        getItem: () => "950",
        setItem: () => undefined,
      },
      lockManager: new ExclusiveLockManager(),
    });

    await expect(gate.run(async () => current, {
      minIntervalMs: 200,
    })).resolves.toBe(1_500);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(150, expect.any(AbortSignal));
  });

  it("cancels an interval wait before invoking the provider", async () => {
    const controller = new AbortController();
    const operation = vi.fn(async () => "unexpected");
    const gate = new GeminiCrossTabGate({
      now: () => 1_000,
      sleep: (_delayMs, signal) => new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
      storage: {
        getItem: () => "1_000".replace("_", ""),
        setItem: () => undefined,
      },
      lockManager: new ExclusiveLockManager(),
    });

    const pending = gate.run(operation, {
      signal: controller.signal,
      minIntervalMs: 100,
    });
    await Promise.resolve();
    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("serializes and spaces calls per tab when Web Locks are unavailable", async () => {
    const time = clock();
    const gate = new GeminiCrossTabGate({
      now: time.now,
      sleep: time.sleep,
      storage: null,
      lockManager: null,
    });
    const firstDone = deferred<void>();
    const starts: number[] = [];
    const first = gate.run(async () => {
      starts.push(time.now());
      return firstDone.promise;
    }, { minIntervalMs: 100 });
    const second = gate.run(async () => {
      starts.push(time.now());
      return "second";
    }, { minIntervalMs: 100 });

    await vi.waitFor(() => expect(starts).toEqual([0]));
    firstDone.resolve();
    await first;
    await expect(second).resolves.toBe("second");
    expect(starts).toEqual([0, 100]);
  });

  it("rejects invalid intervals before requesting a lock", async () => {
    const locks = new ExclusiveLockManager();
    const gate = new GeminiCrossTabGate({ lockManager: locks });

    expect(() => gate.run(async () => undefined, {
      minIntervalMs: Number.NaN,
    })).toThrow(RangeError);
    expect(locks.requests).toHaveLength(0);
  });
});
