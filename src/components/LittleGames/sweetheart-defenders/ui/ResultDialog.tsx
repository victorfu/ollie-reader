import { CakeSlice, Coins, Star, Trophy } from "lucide-react";
import { starsForRun, summariseRun, type RunOutcome } from "../engine/progress";
import { GACHA_DRAW_COST } from "../../gacha-machine/gachaLogic";
import type { ReactNode } from "react";
import { useLanguage } from "../../../../hooks/useLanguage";
import { T } from "../../../common/T";

type Props = {
  outcome: RunOutcome;
  /** 這一場賺到的扭蛋代幣；0 表示這關的獎勵早就領過了 */
  coinsEarned: number;
  isSettling: boolean;
  settlementError: ReactNode;
  totalWaves: number;
  onRetry: () => void;
  onExit: () => void;
};

export function ResultDialog({
  outcome,
  coinsEarned,
  isSettling,
  settlementError,
  totalWaves,
  onRetry,
  onExit,
}: Props) {
  const stars = starsForRun(outcome);
  const { title, detail } = summariseRun(outcome, totalWaves);
  const cleared = outcome.phase === "cleared";
  const { t } = useLanguage();

  return (
    // z-40：結算視窗蓋住整個畫面，要壓在工具列 header（z-30）之上。
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[16px] border border-black/5 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-2xl">
        <p className="flex justify-center text-[#ff6f9f]" aria-hidden="true">
          {cleared ? (
            <Trophy size={44} strokeWidth={1.5} />
          ) : (
            <CakeSlice size={44} strokeWidth={1.5} className="text-slate-300" />
          )}
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          <T k={title.key} params={title.params} variant="stacked" />
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <T k={detail.key} params={detail.params} />
        </p>

        {cleared && (
          <p
            className="mt-3 flex justify-center gap-1"
            aria-label={t("defenders.result.stars", { stars })}
          >
            {[0, 1, 2].map((index) => (
              <Star
                key={index}
                size={26}
                strokeWidth={1.5}
                aria-hidden="true"
                className={
                  index < stars
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-200 text-slate-200"
                }
              />
            ))}
          </p>
        )}

        {coinsEarned > 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 rounded-[10px] bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            <Coins size={16} strokeWidth={2} aria-hidden="true" />
            <T k="defenders.result.coins" params={{ coins: coinsEarned }} />
            <span className="font-normal text-amber-600/80">
              <T
                k="defenders.result.draws"
                params={{ n: Math.floor(coinsEarned / GACHA_DRAW_COST) }}
              />
            </span>
          </p>
        )}

        {isSettling && (
          <p
            role="status"
            className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-600"
          >
            <span className="loading loading-spinner loading-sm" />
            <T k="defenders.result.settling" />
          </p>
        )}

        {!isSettling && settlementError && (
          <p role="alert" className="mt-3 text-sm font-medium text-amber-700">
            {settlementError}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={isSettling}
            className="min-h-11 rounded-[10px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <T
              k={
                isSettling
                  ? "defenders.result.settling"
                  : cleared
                    ? "defenders.result.playAgain"
                    : "defenders.result.retry"
              }
              variant="stacked"
            />
          </button>
          <button
            type="button"
            onClick={onExit}
            disabled={isSettling}
            className="min-h-11 rounded-[10px] border border-black/5 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <T k="defenders.result.menu" variant="stacked" />
          </button>
        </div>
      </div>
    </div>
  );
}
