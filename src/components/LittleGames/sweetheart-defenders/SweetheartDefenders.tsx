import { useMemo } from "react";
import { PETS } from "./data/pets";
import { ARCHETYPE_BY_ELEMENT, ARCHETYPE_LABEL_ZH, ELEMENT_COLOR } from "./data/elements";

type Props = {
  onExit?: () => void;
};

/**
 * 甜心防衛隊 — 全螢幕塔防遊戲的殼層。
 *
 * 目前是 M0 的骨架：路由、素材管線、寵物資料都接好了，戰鬥畫面（canvas +
 * 模擬迴圈）在 M1 補上。
 */
export default function SweetheartDefenders({ onExit }: Props) {
  // 標題畫面的裝飾用寵物，順便驗證 sprite 管線有正常載入。
  const showcase = useMemo(() => PETS.slice(0, 8), []);

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.55), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.5), transparent 38%), radial-gradient(circle at 50% 100%, rgba(255,232,196,0.6), transparent 45%), #fff7fb",
      }}
    >
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="absolute left-6 top-6 z-20 min-h-11 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          ← 回遊戲列表
        </button>
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
        Sweetheart Defenders
      </p>
      <h1 className="mt-2 text-center text-5xl font-semibold tracking-tight text-slate-900">
        🍰 甜心防衛隊
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-600">
        偷糖果的怪物正往櫃檯前進。把寵物放上塔位，守住架上的蛋糕。
      </p>

      <div className="mt-10 flex flex-wrap items-end justify-center gap-3">
        {showcase.map((pet) => {
          const element = pet.elements[0];
          return (
            <figure
              key={pet.id}
              className="flex w-24 flex-col items-center rounded-[14px] border border-black/5 bg-white/70 p-2 shadow-sm backdrop-blur"
            >
              <img
                src={pet.sprite}
                alt={pet.name}
                className="h-16 w-16 object-contain"
                loading="lazy"
              />
              <figcaption className="mt-1 text-center text-[11px] font-medium leading-tight text-slate-700">
                {pet.nameZh}
              </figcaption>
              <span
                className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-800"
                style={{ backgroundColor: ELEMENT_COLOR[element] }}
              >
                {ARCHETYPE_LABEL_ZH[ARCHETYPE_BY_ELEMENT[element]]}
              </span>
            </figure>
          );
        })}
      </div>

      <p className="mt-10 rounded-full bg-white/70 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
        戰鬥關卡建置中 · 已載入 {PETS.length} 隻寵物
      </p>
    </div>
  );
}
