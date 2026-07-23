import { HP_SCALE_BY_DIFFICULTY } from "../constants";
import { getEnemy } from "../data/enemies";
import type { Difficulty, EnemyKind, WaveSpec } from "../types";

/** 每過一波，敵人血量加成多少。第 15 波約是第 1 波的 3.2 倍。 */
export const HP_GROWTH_PER_WAVE = 0.16;

export type SpawnEntry = {
  /** 這隻怪要在模擬時間的哪一刻生出來（毫秒，絕對時間） */
  atMs: number;
  kind: EnemyKind;
  pathIndex: number;
};

/**
 * 把一波的敵人組合展開成生成排程。
 *
 * 排程一次算完存進 BattleState，之後每幀只要比對時間就好，不必每幀重算。
 */
export function buildSpawnQueue(wave: WaveSpec, startMs: number): SpawnEntry[] {
  const queue: SpawnEntry[] = [];

  for (const group of wave.groups) {
    for (let index = 0; index < group.count; index += 1) {
      queue.push({
        atMs: startMs + group.delayMs + index * group.gapMs,
        kind: group.kind,
        pathIndex: group.pathIndex ?? 0,
      });
    }
  }

  return queue.sort((a, b) => a.atMs - b.atMs);
}

/** 波次帶來的血量成長倍率。 */
export function getWaveHpScale(waveIndex: number): number {
  return 1 + waveIndex * HP_GROWTH_PER_WAVE;
}

/** 一隻怪在某一波、某個難度下的實際血量。 */
export function getEnemyHp(
  kind: EnemyKind,
  waveIndex: number,
  difficulty: Difficulty,
): number {
  const base = getEnemy(kind).hp;
  return Math.round(
    base * getWaveHpScale(waveIndex) * HP_SCALE_BY_DIFFICULTY[difficulty],
  );
}

/**
 * 下一波預告用：這波有哪些怪、各幾隻。
 * 分裂出來的小怪不算，因為那是打的時候才會出現。
 */
export function previewWave(wave: WaveSpec): { kind: EnemyKind; count: number }[] {
  const counts = new Map<EnemyKind, number>();

  for (const group of wave.groups) {
    counts.set(group.kind, (counts.get(group.kind) ?? 0) + group.count);
  }

  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}
