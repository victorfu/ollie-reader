import { THREE_STAR_CAKE_RATIO, TWO_STAR_CAKE_RATIO } from "../constants";
import type { BattlePhase } from "../types";

export type Stars = 0 | 1 | 2 | 3;

/**
 * 一場結束後需要知道的東西。BattleState 結構上就滿足這個型別，但結算畫面只拿
 * 這幾個欄位的快照，不去讀還在被模擬迴圈改動的物件。
 */
export type RunOutcome = {
  phase: BattlePhase;
  cakes: number;
  maxCakes: number;
  kills: number;
  waveIndex: number;
};

/**
 * 通關評價：看櫃檯上還剩幾塊蛋糕。
 * 沒通關一律 0 星——星等是給通關用的，不是安慰獎。
 */
export function starsForRun(state: RunOutcome): Stars {
  if (state.phase !== "cleared") return 0;
  if (state.cakes <= 0) return 0;

  const ratio = state.cakes / state.maxCakes;
  if (ratio >= THREE_STAR_CAKE_RATIO) return 3;
  if (ratio >= TWO_STAR_CAKE_RATIO) return 2;
  return 1;
}

/**
 * 失敗時給的鼓勵訊息。刻意不寫 Game Over——寫「撐到第幾波」比較容易讓人
 * 想再試一次。
 */
export function summariseRun(
  state: RunOutcome,
  totalWaves: number,
): { title: string; detail: string } {
  if (state.phase === "cleared") {
    return {
      title: "守住了！",
      detail: `蛋糕還剩 ${state.cakes} 塊 · 擊倒 ${state.kills} 隻怪`,
    };
  }

  const reached = state.waveIndex + 1;
  const remaining = totalWaves - reached;

  return {
    title: `這次撐到第 ${reached} 波！`,
    detail:
      remaining <= 3
        ? `離通關只差 ${remaining} 波 · 擊倒 ${state.kills} 隻怪`
        : `擊倒 ${state.kills} 隻怪 · 再試一次一定更好`,
  };
}
