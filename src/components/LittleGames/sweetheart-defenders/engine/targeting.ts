import { distanceSquared } from "./path";
import type { LiveEnemy, Vec2 } from "../types";

/**
 * 選一個攻擊目標：射程內最接近櫃檯的那隻。
 *
 * 這是塔防的標準打法——先打快要偷到蛋糕的怪，而不是打最近或血最多的。
 * 暈眩中的怪照樣算目標（牠還在路上，只是暫時走不動）。
 */
export function findTarget(
  origin: Vec2,
  range: number,
  enemies: LiveEnemy[],
): LiveEnemy | null {
  const rangeSquared = range * range;
  let best: LiveEnemy | null = null;

  for (const enemy of enemies) {
    if (distanceSquared(origin, enemy) > rangeSquared) continue;
    if (best === null || enemy.remaining < best.remaining) {
      best = enemy;
    }
  }

  return best;
}

/** 濺射與範圍傷害用：找出以 center 為圓心、半徑內的所有敵人。 */
export function findEnemiesInRadius(
  center: Vec2,
  radius: number,
  enemies: LiveEnemy[],
): LiveEnemy[] {
  const radiusSquared = radius * radius;
  return enemies.filter(
    (enemy) => distanceSquared(center, enemy) <= radiusSquared,
  );
}
