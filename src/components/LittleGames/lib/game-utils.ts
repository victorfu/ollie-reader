import { GAME_CONFIG } from "./constants";
import type { GameObject } from "./types";

// Keep scores usable for the current page even when storage is blocked or full.
const memoryBestScores = new Map<string, number>();
const storageConvergenceQueues = new Map<string, Promise<void>>();
let bestScoreStorageListenerInstalled = false;

function storedNonNegativeInteger(key: string): number {
  const stored = getLocalStorageItem(key);
  if (!stored) return 0;
  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function scheduleStorageConvergence(
  key: string,
  converge: () => void,
): void {
  const previous = storageConvergenceQueues.get(key) ?? Promise.resolve();
  const queued = previous
    .then(async () => {
      const locks = globalThis.navigator?.locks;
      if (locks) {
        await locks.request(`ollie-storage:${key}`, async () => converge());
      } else {
        converge();
      }
    })
    .catch(() => {
      // Storage is an optional enhancement; the in-memory state remains live.
    })
    .finally(() => {
      if (storageConvergenceQueues.get(key) === queued) {
        storageConvergenceQueues.delete(key);
      }
    });
  storageConvergenceQueues.set(key, queued);
}

export async function flushStorageConvergence(key: string): Promise<void> {
  await storageConvergenceQueues.get(key);
}

function ensureBestScoreStorageListener(): void {
  if (bestScoreStorageListenerInstalled || typeof window === "undefined") return;
  bestScoreStorageListenerInstalled = true;
  window.addEventListener("storage", (event) => {
    if (!event.key || !memoryBestScores.has(event.key)) return;
    const eventScore = event.newValue
      ? Number.parseInt(event.newValue, 10)
      : 0;
    const bestScore = Math.max(
      memoryBestScores.get(event.key) ?? 0,
      Number.isFinite(eventScore) ? eventScore : 0,
      storedNonNegativeInteger(event.key),
    );
    memoryBestScores.set(event.key, bestScore);
    if (storedNonNegativeInteger(event.key) < bestScore) {
      setLocalStorageItem(event.key, String(bestScore));
    }
  });
}

export function getLocalStorageItem(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocalStorageItem(key: string, value: string): boolean {
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function checkCollision(obj1: GameObject, obj2: GameObject): boolean {
  return (
    obj1.x < obj2.x + obj2.width &&
    obj1.x + obj1.width > obj2.x &&
    obj1.y < obj2.y + obj2.height &&
    obj1.y + obj1.height > obj2.y
  );
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getBestScore(
  key: string = GAME_CONFIG.SCORING.BEST_SCORE_KEY,
): number {
  ensureBestScoreStorageListener();
  const fallbackScore = memoryBestScores.get(key) ?? 0;

  try {
    const stored = getLocalStorageItem(key);
    if (!stored) return fallbackScore;
    const parsed = parseInt(stored, 10);
    if (isNaN(parsed)) return fallbackScore;

    const bestScore = Math.max(parsed, fallbackScore);
    memoryBestScores.set(key, bestScore);
    return bestScore;
  } catch {
    return fallbackScore;
  }
}

export function setBestScore(
  score: number,
  key: string = GAME_CONFIG.SCORING.BEST_SCORE_KEY,
): number {
  ensureBestScoreStorageListener();
  const bestScore = Math.max(score, getBestScore(key));
  memoryBestScores.set(key, bestScore);
  setLocalStorageItem(key, bestScore.toString());
  scheduleStorageConvergence(key, () => {
    const converged = Math.max(
      bestScore,
      memoryBestScores.get(key) ?? 0,
      storedNonNegativeInteger(key),
    );
    memoryBestScores.set(key, converged);
    if (storedNonNegativeInteger(key) < converged) {
      setLocalStorageItem(key, String(converged));
    }
  });
  return bestScore;
}
