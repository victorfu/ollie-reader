type CareStat = {
  label: string;
  emoji: string;
  value: number;
  floor: number;
  color: string;
  softColor: string;
};

type CottageStatusBarProps = {
  fullness: number;
  clean: number;
  mood: number;
  level: number;
  levelTitle: string;
  bondTotal: number;
  bondProgress: number;
  bondNeeded: number;
  dailyEarned: number;
  dailyCap: number;
};

function percent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function CareStatCard({ stat }: { stat: CareStat }) {
  return (
    <div className={`rounded-[14px] border border-white/65 ${stat.softColor} px-3 py-2.5 shadow-sm backdrop-blur-md`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-700 sm:text-sm">
          <span className="text-base" aria-hidden="true">{stat.emoji}</span>
          <span className="truncate">{stat.label}</span>
        </span>
        <span className="text-xs font-black tabular-nums text-slate-800">{Math.round(stat.value)}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/75 shadow-inner"
        role="progressbar"
        aria-label={`${stat.label} ${Math.round(stat.value)}`}
        aria-valuemin={stat.floor}
        aria-valuemax={100}
        aria-valuenow={Math.round(stat.value)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${stat.color}`}
          style={{ width: `${percent(stat.value)}%` }}
        />
      </div>
    </div>
  );
}

export function CottageStatusBar({
  fullness,
  clean,
  mood,
  level,
  levelTitle,
  bondTotal,
  bondProgress,
  bondNeeded,
  dailyEarned,
  dailyCap,
}: CottageStatusBarProps) {
  const stats: CareStat[] = [
    {
      label: "飽足",
      emoji: "🍽️",
      value: fullness,
      floor: 20,
      color: "bg-gradient-to-r from-amber-400 to-orange-400",
      softColor: "bg-amber-50/90",
    },
    {
      label: "清潔",
      emoji: "🛁",
      value: clean,
      floor: 30,
      color: "bg-gradient-to-r from-cyan-400 to-sky-500",
      softColor: "bg-cyan-50/90",
    },
    {
      label: "心情",
      emoji: "💗",
      value: mood,
      floor: 60,
      color: "bg-gradient-to-r from-pink-400 to-rose-500",
      softColor: "bg-pink-50/90",
    },
  ];

  const levelPercent = bondNeeded <= 0 ? 100 : percent((bondProgress / bondNeeded) * 100);

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="大耳狗狀態">
      {stats.map((stat) => <CareStatCard key={stat.label} stat={stat} />)}
      <div className="rounded-[14px] border border-white/65 bg-violet-50/90 px-3 py-2.5 shadow-sm backdrop-blur-md">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-xs font-black text-violet-800 sm:text-sm">⭐ Lv.{level}</span>
            <span className="block truncate text-[10px] font-semibold text-violet-600 sm:text-[11px]">{levelTitle}</span>
          </span>
          <span className="text-right text-[10px] font-bold tabular-nums text-violet-700">
            {bondTotal}<br />
            <span className="font-semibold text-violet-500">今日 {dailyEarned}/{dailyCap}</span>
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/75 shadow-inner"
          role="progressbar"
          aria-label={`親密度等級 ${level}`}
          aria-valuemin={0}
          aria-valuemax={Math.max(1, bondNeeded)}
          aria-valuenow={Math.round(bondProgress)}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${levelPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
