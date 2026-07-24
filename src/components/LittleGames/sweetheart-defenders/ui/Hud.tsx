import { ArrowLeft, CakeSlice, Candy, Pause, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
};

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
}: Props) {
  const inPrep = hud.phase === "prep";
  const finished = hud.phase === "cleared" || hud.phase === "lost";

  return (
    // relative z-30：header 的 backdrop-blur 會自成一個堆疊環境，static 又排在
    // 畫布前面，音量彈窗（z-40）會被關進來、整個沉到畫布底下。給 header 一個明確
    // 的堆疊層級，讓工具列（連同它的彈窗）浮在遊玩區之上、但仍低於結算視窗。
    <header className="relative z-30 border-b border-black/5 bg-white/70 px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex min-h-11 items-center rounded-[8px] px-2 text-slate-600 transition hover:bg-black/5"
          aria-label="回到選單"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <span className="text-sm font-semibold tracking-tight text-slate-800">
          {levelName}
        </span>

        <Stat icon={CakeSlice} label="蛋糕" tone="rose">
          {hud.cakes}/{hud.maxCakes}
        </Stat>
        <Stat icon={Candy} label="糖霜" tone="amber">
          {hud.frosting}
        </Stat>
        <Stat label="波次" tone="slate">
          {hud.waveNumber}/{hud.waveCount}
        </Stat>

        <div className="ml-auto flex items-center gap-2">
          <AudioButton {...audio} align="right" />

          {!finished && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-pressed={paused}
              className={`flex min-h-11 items-center gap-1.5 rounded-[8px] border px-3 text-sm font-semibold shadow-sm transition ${
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
              {paused ? "繼續" : "暫停"}
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

const TONES = {
  rose: "bg-rose-100/70 text-rose-700",
  amber: "bg-amber-100/70 text-amber-700",
  slate: "bg-slate-100/70 text-slate-700",
} as const;

function Stat({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONES[tone]}`}
      // 圖示是裝飾，文字標籤才是給輔助技術讀的。
      aria-label={label}
    >
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      <span className="text-[11px] font-medium opacity-70">{label}</span>
      {children}
    </span>
  );
}
