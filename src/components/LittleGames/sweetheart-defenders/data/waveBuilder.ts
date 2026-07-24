import type { EnemyKind, WaveGroup, WaveSpec } from "../types";

/**
 * 波表產生器。
 *
 * 十二張地圖 × 10 波 = 120 波，全部手寫大概三百多筆設定，之後想調難度就得
 * 逐筆改——所以改成用「節奏」描述：每張地圖只說自己有哪些怪、整體強度多少，
 * 波次的形狀由這裡統一產生。要重新平衡就是改一個 intensity 數字。
 *
 * 節奏以五波為一循環，Boss 固定落在第 5、10 波：
 *   1 群攻 → 2 混合 → 3 重甲 → 4 快攻 → 5 Boss
 */
export type WavePlan = {
  /** 量大但便宜的雜兵 */
  swarm: EnemyKind[];
  /** 快又脆，逼玩家放減速或範圍 */
  rush: EnemyKind[];
  /** 硬又慢，逼玩家放高傷或破甲 */
  tank: EnemyKind[];
  /** 第 5 / 10 波的 Boss，不夠就重複用最後一隻 */
  bosses: EnemyKind[];
  /** 整體數量倍率。越後面的地圖越高。 */
  intensity: number;
  /** 這張地圖有幾條路；敵人會平均分到各條路上 */
  pathCount: number;
  /** 一共幾波 */
  waveCount?: number;
};

/**
 * 一關 10 波。15 波的版本一場要打十幾分鐘，對小孩太長；波數砍掉三分之一，
 * 每波的成長率（這裡跟 waves.ts）相應調高，讓第 10 波的壓力接近原本第 15 波。
 */
const DEFAULT_WAVE_COUNT = 10;
/** 每過一波，敵人數量成長多少。血量成長另外由 waves.ts 負責。 */
const COUNT_GROWTH_PER_WAVE = 0.16;

export function buildWaves(plan: WavePlan): WaveSpec[] {
  const waveCount = plan.waveCount ?? DEFAULT_WAVE_COUNT;
  const waves: WaveSpec[] = [];

  for (let index = 0; index < waveCount; index += 1) {
    waves.push({
      groups: groupsForWave(plan, index),
      bonus: 15 + index * 4,
    });
  }

  return waves;
}

function groupsForWave(plan: WavePlan, index: number): WaveGroup[] {
  const scale = (1 + index * COUNT_GROWTH_PER_WAVE) * plan.intensity;
  const amount = (base: number) => Math.max(1, Math.round(base * scale));

  switch (index % 5) {
    // 群攻：一大群雜兵，練清場
    case 0:
      return spread(plan, [
        {
          kind: pick(plan.swarm, index),
          count: amount(7),
          gapMs: 700,
          delayMs: 0,
        },
        {
          kind: pick(plan.swarm, index + 1),
          count: amount(4),
          gapMs: 600,
          delayMs: 4000,
        },
      ]);

    // 混合：雜兵 + 快攻 + 一兩隻硬的
    case 1:
      return spread(plan, [
        {
          kind: pick(plan.swarm, index),
          count: amount(6),
          gapMs: 650,
          delayMs: 0,
        },
        {
          kind: pick(plan.rush, index),
          count: amount(4),
          gapMs: 420,
          delayMs: 2500,
        },
        {
          kind: pick(plan.tank, index),
          count: amount(1),
          gapMs: 2200,
          delayMs: 6000,
        },
      ]);

    // 重甲：慢慢走的肉盾，配一點雜兵騷擾
    case 2:
      return spread(plan, [
        {
          kind: pick(plan.tank, index),
          count: amount(3),
          gapMs: 2000,
          delayMs: 0,
        },
        {
          kind: pick(plan.swarm, index),
          count: amount(5),
          gapMs: 700,
          delayMs: 1500,
        },
      ]);

    // 快攻：間隔很短的一波衝刺
    case 3:
      return spread(plan, [
        {
          kind: pick(plan.rush, index),
          count: amount(6),
          gapMs: 340,
          delayMs: 0,
        },
        {
          kind: pick(plan.rush, index + 1),
          count: amount(3),
          gapMs: 400,
          delayMs: 3500,
        },
      ]);

    // Boss：最後一波放兩隻，前面的只有一隻
    default: {
      const isFinale = index >= (plan.waveCount ?? DEFAULT_WAVE_COUNT) - 1;
      const bossIndex = Math.floor(index / 5);
      return spread(plan, [
        {
          kind: plan.bosses[Math.min(bossIndex, plan.bosses.length - 1)],
          count: isFinale ? 2 : 1,
          gapMs: 7000,
          delayMs: 0,
        },
        {
          kind: pick(plan.tank, index),
          count: amount(2),
          gapMs: 2200,
          delayMs: 3000,
        },
        {
          kind: pick(plan.swarm, index),
          count: amount(5),
          gapMs: 650,
          delayMs: 5500,
        },
      ]);
    }
  }
}

/**
 * 把各組平均分到不同路徑上。
 *
 * 多路地圖如果整波都走同一條，另一條就變成裝飾品；輪流指派可以逼玩家兩邊
 * 都顧。單路地圖這裡等於什麼都沒做。
 */
function spread(plan: WavePlan, groups: WaveGroup[]): WaveGroup[] {
  if (plan.pathCount <= 1) return groups;

  return groups.flatMap((group, groupIndex) => {
    // 太少隻就不用拆，整組丟同一條路即可。
    if (group.count < plan.pathCount * 2) {
      return [{ ...group, pathIndex: groupIndex % plan.pathCount }];
    }

    const perPath = Math.floor(group.count / plan.pathCount);
    const remainder = group.count - perPath * plan.pathCount;

    return Array.from({ length: plan.pathCount }, (_, pathIndex) => ({
      ...group,
      pathIndex,
      count: perPath + (pathIndex < remainder ? 1 : 0),
      // 各路稍微錯開，才不會像閱兵一樣整齊。
      delayMs: group.delayMs + pathIndex * 260,
    }));
  });
}

/** 在池子裡輪流取，讓同一種節奏在不同波用到不同的怪。 */
function pick(pool: EnemyKind[], index: number): EnemyKind {
  return pool[index % pool.length];
}
