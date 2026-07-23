import { useState } from "react";
import { LEVELS } from "../data/levels";
import { PETS } from "../data/pets";
import { getEnemy } from "../data/enemies";
import { isLevelUnlocked, nextPlayableLevelId } from "../data/unlocks";
import { previewWave } from "../engine/waves";
import type { Stars } from "../engine/progress";
import type { Difficulty } from "../types";

const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "輕鬆", hint: "蛋糕 12 塊" },
  { id: "normal", label: "普通", hint: "蛋糕 10 塊" },
  { id: "hard", label: "挑戰", hint: "蛋糕 8 塊" },
];

type Props = {
  levelStars: Record<string, Stars>;
  unlockedPetIds: string[];
  onStart: (levelId: string, difficulty: Difficulty) => void;
  onExit?: () => void;
};

/**
 * 闖關路線。
 *
 * 刻意做成一條由上往下的線而不是一整片卡片牆——五張圖攤開來讓人隨便挑，
 * 看起來就像五個獨立的小遊戲；串成一條路才會讓人想「再過一關」。
 * 開放規則本身在 data/unlocks.ts，這裡只負責畫。
 */
export function TitleScreen({
  levelStars,
  unlockedPetIds,
  onStart,
  onExit,
}: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const unlockedPets = PETS.filter((pet) => unlockedPetIds.includes(pet.id));
  const nextLevelId = nextPlayableLevelId(levelStars);
  const clearedCount = LEVELS.filter(
    (level) => (levelStars[level.id] ?? 0) > 0,
  ).length;

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

      <header className="mt-10 flex flex-col items-center sm:mt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Sweetheart Defenders
        </p>
        <h1 className="mt-2 text-center text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          🍰 甜心防衛隊
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          闖關進度 {clearedCount} / {LEVELS.length}
        </p>
      </header>

      <fieldset className="mt-6 flex flex-col items-center">
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
              <span className="ml-1.5 text-[11px] font-normal opacity-75">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <ol className="mt-7 w-full max-w-xl">
        {LEVELS.map((level, index) => {
          const stars = levelStars[level.id] ?? 0;
          const unlocked = isLevelUnlocked(level.id, levelStars);
          const isNext = level.id === nextLevelId && unlocked;
          const isLast = index === LEVELS.length - 1;

          return (
            <li key={level.id} className="relative flex gap-3 pb-3 last:pb-0">
              {/* 把關卡串成一條線；已通關的線是實心的，還沒到的是虛線。 */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute left-5 top-11 bottom-0 w-0.5 -translate-x-1/2 ${
                    stars > 0
                      ? "bg-[#ff6f9f]/45"
                      : "border-l-2 border-dashed border-slate-300"
                  }`}
                />
              )}

              <StageBadge index={index} stars={stars} unlocked={unlocked} />

              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onStart(level.id, difficulty)}
                className={`flex flex-1 flex-col items-start rounded-[14px] border p-3 text-left shadow-sm transition ${
                  !unlocked
                    ? "cursor-not-allowed border-black/5 bg-white/45"
                    : isNext
                      ? "border-[#ff6f9f] bg-white ring-2 ring-[#ff6f9f]/25 hover:-translate-y-0.5 hover:shadow-lg"
                      : "border-black/5 bg-white/85 hover:-translate-y-0.5 hover:shadow-lg"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className={`text-base font-semibold tracking-tight ${
                      unlocked ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {unlocked ? level.nameZh : "？？？"}
                  </span>

                  {unlocked ? (
                    <span className="shrink-0 rounded-full bg-[#ff6f9f] px-3 py-1 text-xs font-semibold text-white">
                      {stars > 0 ? "再挑戰" : "開始"}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm text-slate-400">🔒</span>
                  )}
                </div>

                {unlocked ? (
                  <>
                    <span className="mt-0.5 text-xs text-slate-500">
                      {level.waves.length} 波 · {level.slots.length} 個塔位
                      {level.paths.length > 1 && ` · ${level.paths.length} 條路`}
                    </span>

                    {newEnemyNames(index).length > 0 && (
                      <span className="mt-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                        新怪物：{newEnemyNames(index).join("、")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="mt-0.5 text-xs text-slate-400">
                    先通關「{LEVELS[index - 1].nameZh}」
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="mt-7 w-full max-w-xl">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          已解鎖的夥伴 {unlockedPets.length} / {PETS.length}
        </h2>
        <div className="flex flex-wrap gap-2">
          {unlockedPets.map((pet) => (
            <figure
              key={pet.id}
              className="flex w-[72px] flex-col items-center rounded-[12px] border border-black/5 bg-white/70 p-1.5 shadow-sm backdrop-blur"
            >
              <img
                src={pet.sprite}
                alt={pet.name}
                className="h-10 w-10 object-contain"
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

/** 路線上的關卡節點：通關顯示星數，還沒開放顯示鎖頭。 */
function StageBadge({
  index,
  stars,
  unlocked,
}: {
  index: number;
  stars: Stars;
  unlocked: boolean;
}) {
  const cleared = stars > 0;

  return (
    <div className="z-10 flex w-10 shrink-0 flex-col items-center">
      <span
        className={`flex size-10 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
          cleared
            ? "bg-[#ff6f9f] text-white"
            : unlocked
              ? "border-2 border-[#ff6f9f] bg-white text-[#ff6f9f]"
              : "border border-black/5 bg-white/60 text-slate-300"
        }`}
      >
        {index + 1}
      </span>

      {cleared && (
        <span className="mt-0.5 text-[10px] leading-none tracking-tight text-amber-400">
          {"★".repeat(stars)}
          <span className="text-slate-200">{"★".repeat(3 - stars)}</span>
        </span>
      )}
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
