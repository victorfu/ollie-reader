import { GAME_CONFIG } from "./constants";
import type { GameObject } from "./types";

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

export function getBestScore(): number {
  const stored = localStorage.getItem(GAME_CONFIG.SCORING.BEST_SCORE_KEY);
  if (!stored) return 0;
  const parsed = parseInt(stored, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function setBestScore(score: number): void {
  localStorage.setItem(GAME_CONFIG.SCORING.BEST_SCORE_KEY, score.toString());
}
