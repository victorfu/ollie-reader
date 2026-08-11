import { GAME_CONFIG } from "./constants";
import type { GameObject } from "./types";

// Keep scores usable for the current page even when storage is blocked or full.
const memoryBestScores = new Map<string, number>();

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
  const fallbackScore = memoryBestScores.get(key) ?? 0;

  try {
    const stored = globalThis.localStorage.getItem(key);
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
): void {
  memoryBestScores.set(key, Math.max(score, memoryBestScores.get(key) ?? 0));

  try {
    globalThis.localStorage.setItem(key, score.toString());
  } catch {
    // The in-memory fallback above keeps the game playable for this session.
  }
}
