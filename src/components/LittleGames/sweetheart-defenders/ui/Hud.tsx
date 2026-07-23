import type { HudSnapshot } from "./BattleScreen";

type Props = {
  hud: HudSnapshot;
  levelName: string;
  onStartWave: () => void;
  onToggleSpeed: () => void;
  onExit: () => void;
};

export function Hud({
  hud,
  levelName,
  onStartWave,
  onToggleSpeed,
  onExit,
}: Props) {
  const inPrep = hud.phase === "prep";

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-white/70 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onExit}
        className="min-h-11 rounded-[8px] px-2 text-sm font-semibold text-slate-600 transition hover:bg-black/5"
      >
        ←
      </button>

      <span className="text-sm font-semibold tracking-tight text-slate-800">
        {levelName}
      </span>

      <Stat label="蛋糕" tone="rose">
        {hud.cakes}/{hud.maxCakes}
      </Stat>
      <Stat label="糖霜" tone="amber">
        {hud.frosting}
      </Stat>
      <Stat label="波次" tone="slate">
        {hud.waveNumber}/{hud.waveCount}
      </Stat>

      <div className="ml-auto flex items-center gap-2">
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
    </header>
  );
}

const TONES = {
  rose: "bg-rose-100/70 text-rose-700",
  amber: "bg-amber-100/70 text-amber-700",
  slate: "bg-slate-100/70 text-slate-700",
} as const;

function Stat({
  label,
  tone,
  children,
}: {
  label: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex items-baseline gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONES[tone]}`}
    >
      <span className="text-[11px] font-medium opacity-70">{label}</span>
      {children}
    </span>
  );
}
