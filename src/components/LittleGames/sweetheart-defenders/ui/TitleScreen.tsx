import { useState } from "react";
import { LEVELS } from "../data/levels";
import { PETS, STARTER_PET_IDS } from "../data/pets";
import type { Difficulty } from "../types";

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "輕鬆", hint: "怪比較軟，蛋糕 12 塊" },
  { id: "normal", label: "普通", hint: "標準難度，蛋糕 10 塊" },
  { id: "hard", label: "挑戰", hint: "怪很硬，蛋糕只有 8 塊" },
];

type Props = {
  onStart: (levelId: string, difficulty: Difficulty) => void;
  onExit?: () => void;
};

export function TitleScreen({ onStart, onExit }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const starters = PETS.filter((pet) => STARTER_PET_IDS.includes(pet.id));

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center overflow-y-auto px-6 py-10"
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

      <div className="mt-8 flex flex-wrap items-end justify-center gap-3">
        {starters.map((pet) => (
          <figure
            key={pet.id}
            className="flex w-24 flex-col items-center rounded-[14px] border border-black/5 bg-white/70 p-2 shadow-sm backdrop-blur"
          >
            <img
              src={pet.sprite}
              alt={pet.name}
              className="h-16 w-16 object-contain"
            />
            <figcaption className="mt-1 text-center text-[11px] font-medium leading-tight text-slate-700">
              {pet.nameZh}
            </figcaption>
          </figure>
        ))}
      </div>

      <fieldset className="mt-8 flex flex-col items-center">
        <legend className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          難度
        </legend>
        <div className="flex flex-wrap justify-center gap-2">
          {DIFFICULTIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDifficulty(option.id)}
              aria-pressed={difficulty === option.id}
              className={`min-h-11 rounded-[10px] border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                difficulty === option.id
                  ? "border-[#ff6f9f] bg-[#ff6f9f] text-white"
                  : "border-black/5 bg-white/80 text-slate-700 hover:bg-white"
              }`}
            >
              {option.label}
              <span className="ml-2 text-[11px] font-normal opacity-75">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col items-center gap-2">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onStart(level.id, difficulty)}
            className="min-h-11 rounded-[12px] bg-[#ff6f9f] px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.99]"
          >
            開始「{level.nameZh}」· {level.waves.length} 波
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        更多地圖建置中 · 目前開放 {LEVELS.length} 張
      </p>
    </div>
  );
}
