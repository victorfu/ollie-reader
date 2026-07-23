import { getEnemy } from "../data/enemies";
import { previewWave } from "../engine/waves";
import type { WaveSpec } from "../types";

type Props = {
  wave: WaveSpec | undefined;
  waveNumber: number;
};

/**
 * 下一波會來什麼。
 *
 * 塔防最重要的資訊就是「接下來要擋什麼」——沒有預告的話，玩家只能等被打穿了
 * 才知道該換塔。每種怪用自己的配色點一顆點，加上中文名和數量。
 */
export function WavePreview({ wave, waveNumber }: Props) {
  if (!wave) return null;

  const entries = previewWave(wave);
  const hasBoss = entries.some((entry) => getEnemy(entry.kind).boss);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="font-semibold text-slate-500">
        第 {waveNumber} 波
        {hasBoss && (
          <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            BOSS
          </span>
        )}
      </span>

      {entries.map((entry) => {
        const spec = getEnemy(entry.kind);
        return (
          <span
            key={entry.kind}
            className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 font-medium text-slate-600"
          >
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: spec.palette.body }}
            />
            {spec.nameZh}
            <span className="text-slate-400">×{entry.count}</span>
          </span>
        );
      })}
    </div>
  );
}
