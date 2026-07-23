import { starsForRun, summariseRun, type RunOutcome } from "../engine/progress";

type Props = {
  outcome: RunOutcome;
  totalWaves: number;
  onRetry: () => void;
  onExit: () => void;
};

export function ResultDialog({ outcome, totalWaves, onRetry, onExit }: Props) {
  const stars = starsForRun(outcome);
  const { title, detail } = summariseRun(outcome, totalWaves);
  const cleared = outcome.phase === "cleared";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[16px] border border-black/5 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-2xl">
        <p className="text-4xl" aria-hidden="true">
          {cleared ? "🎉" : "🍰"}
        </p>

        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>

        {cleared && (
          <p
            className="mt-3 text-2xl tracking-[0.2em]"
            aria-label={`獲得 ${stars} 顆星`}
          >
            {"★".repeat(stars)}
            <span className="text-slate-300">{"★".repeat(3 - stars)}</span>
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-[10px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
          >
            {cleared ? "再玩一次" : "再試一次"}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 rounded-[10px] border border-black/5 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            回到選單
          </button>
        </div>
      </div>
    </div>
  );
}
