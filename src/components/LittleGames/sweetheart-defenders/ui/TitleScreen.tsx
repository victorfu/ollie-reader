import { useState } from "react";
import { LEVELS } from "../data/levels";
import { PETS } from "../data/pets";
import { getEnemy } from "../data/enemies";
import { previewWave } from "../engine/waves";
import type { Stars } from "../engine/progress";
import type { Difficulty } from "../types";

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "輕鬆", hint: "怪比較軟，蛋糕 12 塊" },
  { id: "normal", label: "普通", hint: "標準難度，蛋糕 10 塊" },
  { id: "hard", label: "挑戰", hint: "怪很硬，蛋糕只有 8 塊" },
];

type Props = {
  levelStars: Record<string, Stars>;
  unlockedPetIds: string[];
  onStart: (levelId: string, difficulty: Difficulty) => void;
  onExit?: () => void;
};

export function TitleScreen({
  levelStars,
  unlockedPetIds,
  onStart,
  onExit,
}: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const unlockedPets = PETS.filter((pet) => unlockedPetIds.includes(pet.id));

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center overflow-y-auto px-4 py-8 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.55), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.5), transparent 38%), radial-gradient(circle at 50% 100%, rgba(255,232,196,0.6), transparent 45%), #fff7fb",
      }}
    >
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="absolute left-4 top-4 z-20 min-h-11 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl sm:left-6 sm:top-6"
        >
          ← 回遊戲列表
        </button>
      )}

      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 sm:mt-2">
        Sweetheart Defenders
      </p>
      <h1 className="mt-2 text-center text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        🍰 甜心防衛隊
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-600">
        偷糖果的怪物正往櫃檯前進。把寵物放上塔位，守住架上的蛋糕。
      </p>

      <fieldset className="mt-7 flex flex-col items-center">
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

      <div className="mt-7 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((level, index) => {
          const stars = levelStars[level.id] ?? 0;
          // 前一關過了才開下一關，免得第一次玩就跳進最難的圖。
          const locked = index > 0 && (levelStars[LEVELS[index - 1].id] ?? 0) === 0;
          const newEnemies = newEnemyNames(index);

          return (
            <button
              key={level.id}
              type="button"
              disabled={locked}
              onClick={() => onStart(level.id, difficulty)}
              className={`flex flex-col items-start rounded-[14px] border p-4 text-left shadow-sm transition ${
                locked
                  ? "cursor-not-allowed border-black/5 bg-white/50 opacity-60"
                  : "border-black/5 bg-white/85 hover:-translate-y-0.5 hover:shadow-lg"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400">
                  第 {index + 1} 關
                </span>
                <span className="text-sm tracking-[0.15em] text-amber-400">
                  {"★".repeat(stars)}
                  <span className="text-slate-200">{"★".repeat(3 - stars)}</span>
                </span>
              </div>

              <span className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                {level.nameZh}
              </span>

              <span className="mt-0.5 text-xs text-slate-500">
                {level.waves.length} 波 · {level.slots.length} 個塔位
                {level.paths.length > 1 && ` · ${level.paths.length} 條路`}
              </span>

              {newEnemies.length > 0 && (
                <span className="mt-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                  新怪物：{newEnemies.join("、")}
                </span>
              )}

              {locked && (
                <span className="mt-2 text-[11px] font-medium text-slate-400">
                  先通關「{LEVELS[index - 1].nameZh}」
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-7 w-full max-w-4xl">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          已解鎖的夥伴 {unlockedPets.length} / {PETS.length}
        </h2>
        <div className="flex flex-wrap gap-2">
          {unlockedPets.map((pet) => (
            <figure
              key={pet.id}
              className="flex w-[76px] flex-col items-center rounded-[12px] border border-black/5 bg-white/70 p-1.5 shadow-sm backdrop-blur"
            >
              <img
                src={pet.sprite}
                alt={pet.name}
                className="h-11 w-11 object-contain"
              />
              <figcaption className="mt-0.5 text-center text-[10px] font-medium leading-tight text-slate-600">
                {pet.nameZh}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          通關解鎖新夥伴，拿到三顆星還會多送兩隻。
        </p>
      </section>
    </div>
  );
}

/** 這一關比前面幾關多出哪些怪，讓玩家知道要準備什麼。 */
function newEnemyNames(levelIndex: number): string[] {
  const seenBefore = new Set(
    LEVELS.slice(0, levelIndex).flatMap((level) =>
      level.waves.flatMap((wave) => previewWave(wave).map((entry) => entry.kind)),
    ),
  );

  const introduced = new Set(
    LEVELS[levelIndex].waves
      .flatMap((wave) => previewWave(wave).map((entry) => entry.kind))
      .filter((kind) => !seenBefore.has(kind)),
  );

  return [...introduced].map((kind) => getEnemy(kind).nameZh);
}
