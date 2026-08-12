import {
  GeminiRateLimitError,
  classifyGeminiRateLimit,
  type GeminiRateLimitDecision,
} from "./geminiErrorPolicy";
import { getGeminiMinimumStartIntervalMs } from "./geminiRuntimeConfig";
import { logger } from "../utils/logger";

const DAILY_BREAKER_PREFIX = "ollie-gemini-daily-breaker-v1:";
const UNKNOWN_BREAKER_PREFIX = "ollie-gemini-unknown-breaker-v1:";
const SHARED_COOLDOWN_PREFIX = "ollie-gemini-cooldown-v1:";
const UNKNOWN_BREAKER_MS = 60_000;
const UNAVAILABLE_STORAGE_DECISION: GeminiRateLimitDecision = {
  kind: "unknown_429",
  retryable: false,
  quotaIds: [],
};

type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface GeminiQueueOptions {
  action: string;
  quotaKey: string;
  signal?: AbortSignal;
}

export interface GeminiRequestQueueConfig {
  getMinimumStartIntervalMs?: () => number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxRetryWindowMs?: number;
  now?: () => number;
  random?: () => number;
  storage?: QueueStorage | null;
}

export interface GeminiProviderErrorObservation {
  decision: GeminiRateLimitDecision;
  crossTabStatePersisted: boolean;
  blockUntil: number;
}

interface QueueJob {
  operation: (signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  action: string;
  quotaKey: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  attempt: number;
  firstAttemptAt?: number;
  notBefore: number;
  state: "queued" | "active" | "settled";
  abortListener: () => void;
}

interface StoredDailyBreaker {
  pacificDay: string;
  decision: GeminiRateLimitDecision;
}

interface StoredUnknownBreaker {
  until: number;
  decision: GeminiRateLimitDecision;
}

interface StoredCooldown {
  until: number;
}

const RATE_LIMIT_KINDS = new Set<GeminiRateLimitDecision["kind"]>([
  "short_rate_limit",
  "short_spend_limit",
  "capacity",
  "daily_exhausted",
  "quota_unavailable",
  "unknown_429",
]);

function isStoredDecision(value: unknown): value is GeminiRateLimitDecision {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeminiRateLimitDecision>;
  return (
    typeof candidate.kind === "string" &&
    RATE_LIMIT_KINDS.has(candidate.kind as GeminiRateLimitDecision["kind"]) &&
    typeof candidate.retryable === "boolean" &&
    Array.isArray(candidate.quotaIds) &&
    candidate.quotaIds.every((quotaId) => typeof quotaId === "string") &&
    (candidate.retryAfterMs === undefined ||
      (typeof candidate.retryAfterMs === "number" &&
        Number.isFinite(candidate.retryAfterMs) &&
        candidate.retryAfterMs >= 0))
  );
}

function defaultStorage(): QueueStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

function pacificDayKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function nextPacificDayStart(timestamp: number): number {
  const currentDay = pacificDayKey(timestamp);
  let lowerBound = timestamp;
  let upperBound = timestamp + 30 * 60 * 60 * 1_000;

  while (pacificDayKey(upperBound) === currentDay) {
    upperBound += 24 * 60 * 60 * 1_000;
  }

  // Find the first millisecond whose Pacific calendar date is different. This
  // naturally handles daylight-saving transitions without a fixed UTC offset.
  while (lowerBound + 1 < upperBound) {
    const midpoint = Math.floor((lowerBound + upperBound) / 2);
    if (pacificDayKey(midpoint) === currentDay) {
      lowerBound = midpoint;
    } else {
      upperBound = midpoint;
    }
  }
  return upperBound;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError());
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class GeminiRequestQueue {
  private readonly getMinimumStartIntervalMs: () => number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxRetryWindowMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly storage: QueueStorage | null;
  private readonly jobs: QueueJob[] = [];
  private readonly dailyBreakers = new Map<string, StoredDailyBreaker>();
  private readonly unknownBreakers = new Map<string, StoredUnknownBreaker>();
  private readonly localCooldowns = new Map<string, number>();
  private readonly sharedCooldowns = new Map<string, StoredCooldown>();
  private running = false;
  private lastStartAt: number | null = null;

  constructor(config: GeminiRequestQueueConfig = {}) {
    this.getMinimumStartIntervalMs =
      config.getMinimumStartIntervalMs ?? getGeminiMinimumStartIntervalMs;
    this.maxRetries = config.maxRetries ?? 2;
    this.baseBackoffMs = config.baseBackoffMs ?? 2_000;
    this.maxRetryWindowMs = config.maxRetryWindowMs ?? 120_000;
    this.now = config.now ?? Date.now;
    this.random = config.random ?? Math.random;
    this.storage =
      config.storage === undefined ? defaultStorage() : config.storage;
  }

  run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: GeminiQueueOptions,
  ): Promise<T> {
    if (options.signal?.aborted) return Promise.reject(abortError());

    const blocked = this.readBreaker(options.quotaKey);
    if (blocked) return Promise.reject(new GeminiRateLimitError(blocked));

    const controller = options.signal ? null : new AbortController();
    const signal = options.signal ?? controller!.signal;

    return new Promise<T>((resolve, reject) => {
      const job: QueueJob = {
        operation: operation as (signal: AbortSignal) => Promise<unknown>,
        signal,
        action: options.action,
        quotaKey: options.quotaKey,
        resolve: resolve as (value: unknown) => void,
        reject,
        attempt: 0,
        notBefore: 0,
        state: "queued",
        abortListener: () => undefined,
      };

      job.abortListener = () => {
        if (job.state !== "queued") return;
        const index = this.jobs.indexOf(job);
        if (index >= 0) this.jobs.splice(index, 1);
        this.rejectJob(job, abortError());
      };
      signal.addEventListener("abort", job.abortListener, { once: true });
      this.jobs.push(job);
      void this.pump();
    });
  }

  /**
   * Re-checks model-wide breaker and cooldown state. Call this while holding
   * the cross-tab provider lock so an already-waiting tab cannot race a 429
   * observed by the previous lock holder.
   */
  async waitForSharedAvailability(
    quotaKey: string,
    signal: AbortSignal,
  ): Promise<void> {
    while (true) {
      const blocked = this.readBreaker(quotaKey);
      if (blocked) throw new GeminiRateLimitError(blocked);

      const readyAt = Math.max(
        this.readLocalCooldownUntil(quotaKey),
        this.readSharedCooldownUntil(quotaKey),
      );
      const remaining = readyAt - this.now();
      if (remaining <= 0) return;
      await abortableDelay(remaining, signal);
    }
  }

  /**
   * Records structured provider 429 state before the cross-tab lock is
   * released. The outer queue still owns retry counts and user-facing errors.
   */
  observeProviderError(
    error: unknown,
    quotaKey: string,
  ): GeminiProviderErrorObservation | null {
    const decision = classifyGeminiRateLimit(error);
    if (!decision) return null;

    let crossTabStatePersisted: boolean;
    let blockUntil: number;
    if (decision.kind === "daily_exhausted") {
      blockUntil = nextPacificDayStart(this.now());
      crossTabStatePersisted = this.writeDailyBreaker(quotaKey, decision);
    } else if (!decision.retryable) {
      blockUntil = this.now() + UNKNOWN_BREAKER_MS;
      crossTabStatePersisted = this.writeUnknownBreaker(quotaKey, decision);
    } else {
      const delay = Math.max(
        0,
        this.baseBackoffMs,
        this.getMinimumStartIntervalMs(),
        decision.retryAfterMs ?? 0,
      );
      blockUntil = this.now() + delay;
      crossTabStatePersisted = this.writeSharedCooldownUntil(
        quotaKey,
        blockUntil,
      );
    }

    return { decision, crossTabStatePersisted, blockUntil };
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift();
        if (!job || job.state === "settled") continue;
        if (job.signal.aborted) {
          this.rejectJob(job, abortError());
          continue;
        }

        const blocked = this.readBreaker(job.quotaKey);
        if (blocked) {
          this.rejectJob(job, new GeminiRateLimitError(blocked));
          continue;
        }

        job.state = "active";
        try {
          await this.waitForStart(job);

          const blockedAfterWait = this.readBreaker(job.quotaKey);
          if (blockedAfterWait) {
            this.rejectJob(job, new GeminiRateLimitError(blockedAfterWait));
            continue;
          }

          if (job.signal.aborted) throw abortError();
          const startedAt = this.now();
          this.lastStartAt = startedAt;
          job.firstAttemptAt ??= startedAt;
          logger.debug("Starting queued Gemini request", {
            action: job.action,
            attempt: job.attempt + 1,
          });
          const value = await job.operation(job.signal);
          if (job.signal.aborted) throw abortError();
          this.resolveJob(job, value);
        } catch (error) {
          if (job.signal.aborted) {
            this.rejectJob(job, abortError());
            continue;
          }

          const observation = this.observeProviderError(error, job.quotaKey);
          if (!observation) {
            this.rejectJob(job, error);
            continue;
          }
          const { decision } = observation;

          if (decision.kind === "daily_exhausted") {
            this.rejectJob(job, new GeminiRateLimitError(decision, error));
            this.rejectQueued(job.quotaKey, decision);
            continue;
          }

          if (!decision.retryable) {
            this.rejectJob(job, new GeminiRateLimitError(decision, error));
            this.rejectQueued(job.quotaKey, decision);
            continue;
          }

          const retryDelay = this.retryDelay(job, decision);
          const retryDeadline = (job.firstAttemptAt ?? this.now()) + this.maxRetryWindowMs;
          if (
            job.attempt >= this.maxRetries ||
            this.now() + retryDelay > retryDeadline
          ) {
            // Do not let every pending job repeat the same exhausted retry
            // sequence. Pause this model briefly and require a fresh action.
            this.writeUnknownBreaker(job.quotaKey, decision);
            this.rejectJob(job, new GeminiRateLimitError(decision, error));
            this.rejectQueued(job.quotaKey, decision);
            continue;
          }

          job.attempt += 1;
          job.notBefore = this.now() + retryDelay;
          this.writeSharedCooldownUntil(job.quotaKey, job.notBefore);
          job.state = "queued";
          // Resolve the provider-wide throttle before allowing later jobs to
          // start; otherwise each queued job could hit the same 429 window.
          this.jobs.unshift(job);
          logger.warn("Gemini request temporarily limited; retry scheduled", {
            action: job.action,
            attempt: job.attempt,
            retryDelay,
            kind: decision.kind,
          });
        }
      }
    } finally {
      this.running = false;
      if (this.jobs.length > 0) void this.pump();
    }
  }

  private async waitForStart(job: QueueJob): Promise<void> {
    while (true) {
      const interval = Math.max(0, this.getMinimumStartIntervalMs());
      const intervalReadyAt =
        this.lastStartAt === null ? 0 : this.lastStartAt + interval;
      const readyAt = Math.max(
        intervalReadyAt,
        this.readLocalCooldownUntil(job.quotaKey),
        this.readSharedCooldownUntil(job.quotaKey),
        job.notBefore,
      );
      const remaining = readyAt - this.now();
      if (remaining <= 0) return;
      await abortableDelay(remaining, job.signal);
    }
  }

  private retryDelay(
    job: QueueJob,
    decision: GeminiRateLimitDecision,
  ): number {
    const interval = Math.max(0, this.getMinimumStartIntervalMs());
    const backoff = this.baseBackoffMs * 2 ** job.attempt;
    const floor = Math.max(interval, backoff, decision.retryAfterMs ?? 0);
    const jitterMax = Math.min(2_000, floor * 0.2);
    return Math.ceil(floor + this.random() * jitterMax);
  }

  private resolveJob(job: QueueJob, value: unknown): void {
    if (job.state === "settled") return;
    job.state = "settled";
    job.signal.removeEventListener("abort", job.abortListener);
    job.resolve(value);
  }

  private rejectJob(job: QueueJob, error: unknown): void {
    if (job.state === "settled") return;
    job.state = "settled";
    job.signal.removeEventListener("abort", job.abortListener);
    job.reject(error);
  }

  private rejectQueued(
    quotaKey: string,
    decision: GeminiRateLimitDecision,
  ): void {
    for (let index = this.jobs.length - 1; index >= 0; index -= 1) {
      const job = this.jobs[index];
      if (job.quotaKey !== quotaKey) continue;
      this.jobs.splice(index, 1);
      this.rejectJob(job, new GeminiRateLimitError(decision));
    }
  }

  private dailyKey(quotaKey: string): string {
    return `${DAILY_BREAKER_PREFIX}${encodeURIComponent(quotaKey)}`;
  }

  private unknownKey(quotaKey: string): string {
    return `${UNKNOWN_BREAKER_PREFIX}${encodeURIComponent(quotaKey)}`;
  }

  private cooldownKey(quotaKey: string): string {
    return `${SHARED_COOLDOWN_PREFIX}${encodeURIComponent(quotaKey)}`;
  }

  private readLocalCooldownUntil(quotaKey: string): number {
    const until = this.localCooldowns.get(quotaKey) ?? 0;
    if (until <= this.now()) {
      this.localCooldowns.delete(quotaKey);
      return 0;
    }
    return until;
  }

  private readSharedCooldownUntil(quotaKey: string): number {
    let until = this.readLocalCooldownUntil(quotaKey);
    const memory = this.sharedCooldowns.get(quotaKey);
    if (memory && Number.isFinite(memory.until) && memory.until > this.now()) {
      until = Math.max(until, memory.until);
    } else if (memory) {
      this.sharedCooldowns.delete(quotaKey);
    }

    if (!this.storage) return until;
    try {
      const key = this.cooldownKey(quotaKey);
      const stored = safeParse<StoredCooldown>(this.storage.getItem(key));
      if (
        stored &&
        Number.isFinite(stored.until) &&
        stored.until > this.now()
      ) {
        this.sharedCooldowns.set(quotaKey, stored);
        until = Math.max(until, stored.until);
      } else if (stored) {
        this.storage.removeItem(key);
      }
    } catch (error) {
      logger.warn("Failed to read the shared Gemini cooldown", error);
    }
    return until;
  }

  private writeSharedCooldownUntil(
    quotaKey: string,
    requestedUntil: number,
  ): boolean {
    if (!Number.isFinite(requestedUntil)) return false;
    const until = Math.max(
      requestedUntil,
      this.readSharedCooldownUntil(quotaKey),
    );
    this.localCooldowns.set(quotaKey, until);
    const value: StoredCooldown = { until };
    this.sharedCooldowns.set(quotaKey, value);
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.cooldownKey(quotaKey), JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn("Failed to persist the shared Gemini cooldown", error);
      return false;
    }
  }

  private readBreaker(quotaKey: string): GeminiRateLimitDecision | null {
    const currentDay = pacificDayKey(this.now());
    const memoryDaily = this.dailyBreakers.get(quotaKey);
    if (
      memoryDaily?.pacificDay === currentDay &&
      isStoredDecision(memoryDaily.decision)
    ) {
      return memoryDaily.decision;
    }
    if (memoryDaily) this.dailyBreakers.delete(quotaKey);

    const memoryUnknown = this.unknownBreakers.get(quotaKey);
    if (
      memoryUnknown &&
      memoryUnknown.until > this.now() &&
      isStoredDecision(memoryUnknown.decision)
    ) {
      return memoryUnknown.decision;
    }
    if (memoryUnknown) this.unknownBreakers.delete(quotaKey);

    if (!this.storage) return null;
    try {
      const dailyKey = this.dailyKey(quotaKey);
      const daily = safeParse<StoredDailyBreaker>(
        this.storage.getItem(dailyKey),
      );
      if (
        daily?.pacificDay === currentDay &&
        isStoredDecision(daily.decision)
      ) {
        this.dailyBreakers.set(quotaKey, daily);
        return daily.decision;
      }
      if (daily) this.storage.removeItem(dailyKey);

      const unknownKey = this.unknownKey(quotaKey);
      const unknown = safeParse<StoredUnknownBreaker>(
        this.storage.getItem(unknownKey),
      );
      if (
        unknown &&
        Number.isFinite(unknown.until) &&
        unknown.until > this.now() &&
        isStoredDecision(unknown.decision)
      ) {
        this.unknownBreakers.set(quotaKey, unknown);
        return unknown.decision;
      }
      if (unknown) this.storage.removeItem(unknownKey);
    } catch (error) {
      logger.warn("Failed to read the local Gemini circuit breaker", error);
      // If persistent state exists but cannot be read, fail closed. Otherwise
      // another tab's daily breaker could be silently bypassed.
      return UNAVAILABLE_STORAGE_DECISION;
    }
    return null;
  }

  private writeDailyBreaker(
    quotaKey: string,
    decision: GeminiRateLimitDecision,
  ): boolean {
    const value: StoredDailyBreaker = {
      pacificDay: pacificDayKey(this.now()),
      decision,
    };
    this.dailyBreakers.set(quotaKey, value);
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.dailyKey(quotaKey), JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn("Failed to persist the Gemini daily circuit breaker", error);
      return false;
    }
  }

  private writeUnknownBreaker(
    quotaKey: string,
    decision: GeminiRateLimitDecision,
  ): boolean {
    const value: StoredUnknownBreaker = {
      until: this.now() + UNKNOWN_BREAKER_MS,
      decision,
    };
    this.unknownBreakers.set(quotaKey, value);
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.unknownKey(quotaKey), JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn("Failed to persist the Gemini temporary circuit breaker", error);
      return false;
    }
  }
}

export const geminiRequestQueue = new GeminiRequestQueue();
