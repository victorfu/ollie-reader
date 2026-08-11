import { ArrowLeft, CakeSlice, Candy, Pause, Play } from "lucide-react";
import type { WaveSpec } from "../types";
import type { AudioControls } from "../useAudioSettings";
import { AudioButton } from "./AudioControls";
import type { HudSnapshot } from "./BattleScreen";
import { WavePreview } from "./WavePreview";

type Props = {
  hud: HudSnapshot;
  levelName: string;
  nextWave: WaveSpec | undefined;
  paused: boolean;
  audio: AudioControls;
  onStartWave: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onExit: () => void;
  exitDisabled?: boolean;
};

/**
 * 戰鬥畫面上方的狀態列。
 *
 * 主要玩家是小朋友，所以剩幾條命和打到第幾波都改成用看的：蛋糕是一排圖示，
 * 被偷走就少一塊；波次是一排點，打完一波填滿一顆。原本是「12/12」「1/10」
 * 這種要先讀數字再心算的寫法。糖霜留數字，因為那個值本來就是拿來跟造價比的。
 */
export function Hud({
  hud,
  levelName,
  nextWave,
  paused,
  audio,
  onStartWave,
  onToggleSpeed,
  onTogglePause,
  onExit,
  exitDisabled = false,
}: Props) {
  const inPrep = hud.phase === "prep";
  const finished = hud.phase === "cleared" || hud.phase === "lost";

  return (
    // relative z-30：header 的 backdrop-blur 會自成一個堆疊環境，static 又排在
    // 畫布前面，音量彈窗（z-40）會被關進來、整個沉到畫布底下。給 header 一個明確
    // 的堆疊層級，讓工具列（連同它的彈窗）浮在遊玩區之上、但仍低於結算視窗。
    <header className="relative z-30 border-b border-black/5 bg-white/70 px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={onExit}
          disabled={exitDisabled}
          className="flex min-h-11 items-center rounded-[8px] px-2 text-slate-600 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="回到選單"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <span className="text-sm font-semibold tracking-tight text-slate-800">
          {levelName}
        </span>

        <CakeMeter cakes={hud.cakes} maxCakes={hud.maxCakes} />

        <span
          className="flex items-center gap-1 rounded-full bg-amber-100/70 px-2.5 py-1 text-sm font-semibold text-amber-700"
          aria-label="糖霜"
        >
          <Candy size={14} strokeWidth={2} aria-hidden="true" />
          {hud.frosting}
        </span>

        <WaveDots current={hud.waveNumber} total={hud.waveCount} />

        <div className="ml-auto flex items-center gap-2">
          <AudioButton {...audio} align="right" />

          {!finished && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-pressed={paused}
              aria-label={paused ? "繼續" : "暫停"}
              className={`flex min-h-11 items-center justify-center rounded-[8px] border px-3 shadow-sm transition ${
                paused
                  ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
                  : "border-black/5 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {paused ? (
                <Play size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Pause size={16} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSpeed}
            className="min-h-11 rounded-[8px] border border-black/5 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="切換遊戲速度"
          >
            {hud.speed}×
          </button>

          {/* 開打後用 invisible 保留佔位而不是卸載：按鈕一下有一下沒，
              右側的暫停／速度鈕會跟著左右跳，整排工具列在每波都閃一次。 */}
          <button
            type="button"
            onClick={onStartWave}
            className={`min-h-11 rounded-[8px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] ${
              inPrep ? "" : "invisible"
            }`}
          >
            開始第 {hud.waveNumber} 波
            {/* 秒數固定寬度：19s → 9s 少一位數時，整顆按鈕才不會每秒抖動。 */}
            <span className="ml-1.5 inline-block w-7 text-left tabular-nums opacity-80">
              {hud.prepSeconds}s
            </span>
          </button>
        </div>
      </div>

      {/* 波次資訊列永遠都在：準備階段看下一波要擋什麼，開打後看這一波是什麼。
          隨 phase 掛載／卸載的話，header 高度會抖，底下 flex-1 的畫布跟著
          重新 letterbox，整個畫面在每波開始與結束時都閃一下。 */}
      <div className="mt-1.5">
        <WavePreview wave={nextWave} waveNumber={hud.waveNumber} />
      </div>
    </header>
  );
}

/**
 * 剩下幾塊蛋糕。
 *
 * 一塊圖示一條命，被偷走的變成空殼——小朋友不用讀「9/12」就知道還剩多少、
 * 剛剛是不是掉了一塊。上限很高時（挑戰以外的難度最多 12）就退回數字，
 * 免得整排圖示把工具列擠爆。
 */
function CakeMeter({ cakes, maxCakes }: { cakes: number; maxCakes: number }) {
  const label = `蛋糕還剩 ${cakes} 塊，共 ${maxCakes} 塊`;

  if (maxCakes > 12) {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-rose-100/70 px-2.5 py-1 text-sm font-semibold text-rose-700"
        aria-label={label}
      >
        <CakeSlice size={14} strokeWidth={2} aria-hidden="true" />
        {cakes}/{maxCakes}
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-0.5 rounded-full bg-rose-100/70 px-2 py-1"
      aria-label={label}
    >
      {Array.from({ length: maxCakes }, (_, index) => (
        <CakeSlice
          key={index}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className={
            index < cakes
              ? "text-rose-600"
              : // 被偷走的留在原位變淡，才看得出「本來有幾塊」。
                "text-rose-300/50"
          }
        />
      ))}
    </span>
  );
}

/** 打到第幾波。一波一顆點，打完填滿，正在打的那顆會亮。 */
function WaveDots({ current, total }: { current: number; total: number }) {
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`第 ${current} 波，共 ${total} 波`}
    >
      {Array.from({ length: total }, (_, index) => {
        const waveNumber = index + 1;
        return (
          <span
            key={waveNumber}
            aria-hidden="true"
            className={`size-2 rounded-full transition-colors ${
              waveNumber < current
                ? "bg-[#ff6f9f]"
                : waveNumber === current
                  ? "bg-[#ff6f9f] ring-2 ring-[#ff6f9f]/30"
                  : "bg-slate-300/70"
            }`}
          />
        );
      })}
    </span>
  );
}
