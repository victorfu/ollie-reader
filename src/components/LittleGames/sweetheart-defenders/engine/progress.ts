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
  /** 每關撐到過的最遠波次（1-based）。輸掉的場次也算，那正是要拿來比的紀錄。 */
  bestWave: Record<string, number>;
  /** 已經領過「首次通關」代幣的關卡 */
  claimedClear: string[];
  /** 已經領過「首次三星」代幣的關卡 */
  claimedThreeStars: string[];
};

/** 一關能給多少扭蛋代幣。 */
export type CoinReward = { clear: number; threeStars: number };

export type RunApplication = {
  progress: CampaignProgress;
  /** 這一場該發多少扭蛋代幣。0 表示沒有新的獎勵可領。 */
  coinsEarned: number;
};

/**
 * 把一場的結果併進進度，並算出該發多少代幣。
 *
 * 星數只進不退（第二次打得比較差不該把三顆星洗掉），最遠波次只會更遠，
 * 領過的獎勵只增不減。回傳新物件而不是就地改，這樣 React 的 setState 直接
 * 吃得下，存檔也只是把回傳值寫出去。
 *
 * 代幣用 claimed 清單擋重複發：重玩已經三星的關卡不會再給錢，不然小孩會發現
 * 一直重打第一關比往後打划算。
 */
export function applyRunResult(
  progress: CampaignProgress,
  levelId: string,
  outcome: RunOutcome,
  reward: CoinReward,
): RunApplication {
  const reachedWave = outcome.waveIndex + 1;
  const bestWave = Math.max(progress.bestWave[levelId] ?? 0, reachedWave);
  const waveImproved = bestWave !== (progress.bestWave[levelId] ?? 0);

  const stars = starsForRun(outcome);
  const bestStars = Math.max(progress.levelStars[levelId] ?? 0, stars) as Stars;
  const starsImproved = bestStars !== (progress.levelStars[levelId] ?? 0);

  const earnsClear = stars > 0 && !progress.claimedClear.includes(levelId);
  const earnsThreeStars =
    stars >= 3 && !progress.claimedThreeStars.includes(levelId);
  const coinsEarned =
    (earnsClear ? reward.clear : 0) + (earnsThreeStars ? reward.threeStars : 0);

  if (!waveImproved && !starsImproved && coinsEarned === 0) {
    return { progress, coinsEarned: 0 };
  }

  return {
    coinsEarned,
    progress: {
      levelStars: starsImproved
        ? { ...progress.levelStars, [levelId]: bestStars }
        : progress.levelStars,
      bestWave: waveImproved
        ? { ...progress.bestWave, [levelId]: bestWave }
        : progress.bestWave,
      claimedClear: earnsClear
        ? [...progress.claimedClear, levelId]
        : progress.claimedClear,
      claimedThreeStars: earnsThreeStars
        ? [...progress.claimedThreeStars, levelId]
        : progress.claimedThreeStars,
    },
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
