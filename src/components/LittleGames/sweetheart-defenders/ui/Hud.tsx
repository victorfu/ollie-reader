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
    <header className="border-b border-black/5 bg-white/70 px-3 py-2 backdrop-blur-md sm:px-4">
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

          {inPrep && (
            <button
              type="button"
              onClick={onStartWave}
              className="min-h-11 rounded-[8px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
            >
              開始第 {hud.waveNumber} 波
              <span className="ml-1.5 opacity-80">{hud.prepSeconds}s</span>
            </button>
          )}
        </div>
      </div>

      {/* 準備階段先看清楚下一波要擋什麼，才有辦法決定蓋哪種塔。 */}
      {inPrep && (
        <div className="mt-1.5">
          <WavePreview wave={nextWave} waveNumber={hud.waveNumber} />
        </div>
      )}
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
