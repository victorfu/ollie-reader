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

/** 玩家的闖關進度。 */
export type CampaignProgress = {
  /** 每關拿過的最高星數 */
  levelStars: Record<string, Stars>;
  unlockedPetIds: string[];
  /** 每關撐到過的最遠波次（1-based）。輸掉的場次也算，那正是要拿來比的紀錄。 */
  bestWave: Record<string, number>;
};

/**
 * 把一場的結果併進進度。
 *
 * 星數只進不退（第二次打得比較差不該把三顆星洗掉），解鎖也只加不減，
 * 最遠波次只會更遠。回傳新物件而不是就地改，這樣 React 的 setState 直接吃得
 * 下，存檔也只是把回傳值寫出去。沒有任何改變時回傳原本那個物件，省下一次
 * 重繪與一次寫入。
 */
export function applyRunResult(
  progress: CampaignProgress,
  levelId: string,
  outcome: RunOutcome,
  petsUnlockedBy: (levelId: string, stars: Stars) => string[],
): CampaignProgress {
  const reachedWave = outcome.waveIndex + 1;
  const bestWave = Math.max(progress.bestWave[levelId] ?? 0, reachedWave);
  const waveImproved = bestWave !== (progress.bestWave[levelId] ?? 0);

  const stars = starsForRun(outcome);
  const bestStars = Math.max(progress.levelStars[levelId] ?? 0, stars) as Stars;
  const starsImproved = bestStars !== (progress.levelStars[levelId] ?? 0);

  if (!waveImproved && !starsImproved) return progress;

  const unlocked = new Set(progress.unlockedPetIds);
  if (starsImproved) {
    for (const petId of petsUnlockedBy(levelId, bestStars)) unlocked.add(petId);
  }

  return {
    levelStars: starsImproved
      ? { ...progress.levelStars, [levelId]: bestStars }
      : progress.levelStars,
    unlockedPetIds: [...unlocked],
    bestWave: waveImproved
      ? { ...progress.bestWave, [levelId]: bestWave }
      : progress.bestWave,
  };
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
