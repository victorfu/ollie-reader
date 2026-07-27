import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CakeSlice, Lock, Star } from "lucide-react";
import { LEVELS } from "../data/levels";
import { CHARACTERS } from "../data/characters";
import type { TowerCharacter } from "../types";
import { getEnemy } from "../data/enemies";
import { isLevelUnlocked, nextPlayableLevelId } from "../data/unlocks";
import { previewWave } from "../engine/waves";
import { playSfx } from "../audio";
import type { Stars } from "../engine/progress";
import type { SyncStatus } from "../storage";
import type { AudioControls } from "../useAudioSettings";
import { AudioButton } from "./AudioControls";
import { CharacterDex } from "./CharacterDex";

type Props = {
  levelStars: Record<string, Stars>;
  /** 每關撐到過的最遠波次，還沒通關的關卡拿來顯示紀錄 */
  bestWave: Record<string, number>;
  availableCharacters: TowerCharacter[];
  syncStatus: SyncStatus;
  isSignedIn: boolean;
  audio: AudioControls;
  onStart: (levelId: string) => void;
  onExit?: () => void;
};

/**
 * 闖關路線。
 *
 * 版面分兩欄：左邊是不會動的控制欄（招牌、進度、難度），右邊只放路線。
 * 之前全部疊成一直欄置中，光招牌加難度就吃掉整個第一屏，要捲一下才看得到
 * 第一關；把它們挪到側欄之後，路線從畫面最上面就開始，也順便把寬螢幕左右
 * 兩片空白用掉。窄螢幕（md 以下）自動退回上下堆疊，側欄變成一條矮工具列。
 *
 * 關卡仍然刻意做成一條由上往下的線而不是一整片卡片牆——十二張圖攤開來讓人
 * 隨便挑，看起來就像十二個獨立的小遊戲；串成一條路才會讓人想「再過一關」。
 * 每張卡固定兩行（標題列 + 資訊列），節奏一致，捲起來也短很多。
 * 開放規則本身在 data/unlocks.ts，這裡只負責畫。
 */
export function TitleScreen({
  levelStars,
  bestWave,
  availableCharacters,
  syncStatus,
  isSignedIn,
  audio,
  onStart,
  onExit,
}: Props) {
  const [dexOpen, setDexOpen] = useState(false);
  const nextLevelId = nextPlayableLevelId(levelStars);
  const clearedCount = LEVELS.filter(
    (level) => (levelStars[level.id] ?? 0) > 0,
  ).length;
  const availableIds = useMemo(
    () => availableCharacters.map((character) => character.id),
    [availableCharacters],
  );

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-y-auto md:flex-row md:overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.55), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.5), transparent 38%), radial-gradient(circle at 50% 100%, rgba(255,232,196,0.6), transparent 45%), #fff7fb",
      }}
    >
      <aside className="flex shrink-0 flex-col gap-2.5 px-4 pb-1.5 pt-3 md:h-screen md:w-[17rem] md:gap-4 md:overflow-y-auto md:border-r md:border-black/5 md:bg-white/40 md:px-5 md:py-5 md:backdrop-blur-xl lg:w-[19rem]">
        {/* 離開、圖鑑、聲音收成同一列。之前三顆都是絕對定位，行動版還得留一段上緣空白閃開它們。 */}
        <div
          className={`flex items-center gap-2 ${onExit ? "justify-between" : "justify-end"}`}
        >
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              回遊戲列表
            </button>
          )}
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSfx("select");
                setDexOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={dexOpen}
              aria-label={`角色圖鑑（已收集 ${availableIds.length} / ${CHARACTERS.length}）`}
              className="flex min-h-11 items-center justify-center rounded-[10px] border border-black/5 bg-white px-3 text-[#ff6f9f] shadow-sm transition hover:bg-slate-50"
            >
              <BookOpen size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <AudioButton {...audio} align="right" />
          </span>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Sweetheart Defenders
          </p>
          <h1 className="mt-0.5 flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-slate-900 lg:text-[1.75rem]">
            <CakeSlice
              size={26}
              strokeWidth={1.5}
              className="shrink-0 text-[#ff6f9f]"
              aria-hidden="true"
            />
            甜心防衛隊
          </h1>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">闖關進度</span>
            <span className="text-xs font-semibold tabular-nums text-slate-700">
              {clearedCount} / {LEVELS.length}
            </span>
          </div>
          {/* 同一份進度多給一個一眼可讀的長度，沒有多佔一列。 */}
          <div
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/75"
          >
            <div
              className="h-full rounded-full bg-[#ff6f9f] transition-[width] duration-500"
              style={{ width: `${(clearedCount / LEVELS.length) * 100}%` }}
            />
          </div>
          <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
        </div>


      </aside>

      <main className="flex-1 px-4 pb-8 pt-2 md:h-screen md:overflow-y-auto md:px-6 md:py-5">
        <div className="mx-auto w-full max-w-2xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            闖關路線
          </p>

          <ol>
            {LEVELS.map((level, index) => {
              const stars = levelStars[level.id] ?? 0;
              const unlocked = isLevelUnlocked(level.id, levelStars);
              const isNext = level.id === nextLevelId && unlocked;
              const isLast = index === LEVELS.length - 1;
              const newEnemies = newEnemyNames(index);
              const record = bestWave[level.id] ?? 0;

              return (
                <li key={level.id} className="relative flex gap-3 pb-2.5 last:pb-0">
                  {/* 把關卡串成一條線；已通關的線是實心的，還沒到的是虛線。 */}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-5 bottom-0 w-0.5 -translate-x-1/2 ${
                        stars > 0
                          ? "top-[3.375rem] bg-[#ff6f9f]/45"
                          : "top-11 border-l-2 border-dashed border-slate-300"
                      }`}
                    />
                  )}

                  <StageBadge index={index} stars={stars} unlocked={unlocked} />

                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onStart(level.id)}
                    className={`flex flex-1 flex-col gap-1 rounded-[14px] border p-2.5 text-left shadow-sm transition sm:p-3 ${
                      !unlocked
                        ? "cursor-not-allowed border-black/5 bg-white/45"
                        : isNext
                          ? "border-[#ff6f9f] bg-white ring-2 ring-[#ff6f9f]/25 hover:-translate-y-0.5 hover:shadow-lg"
                          : "border-black/5 bg-white/85 hover:-translate-y-0.5 hover:shadow-lg"
                    }`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight sm:text-base ${
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
                        <Lock
                          size={16}
                          strokeWidth={2}
                          className="shrink-0 text-slate-400"
                          aria-label="尚未開放"
                        />
                      )}
                    </span>

                    {/* 資訊全部收在同一列，卡片就固定兩行高，一屏能多看好幾關。 */}
                    <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                      {unlocked ? (
                        <>
                          <span className="text-xs text-slate-500">
                            {level.waves.length} 波 · {level.slotPlan.count} 個塔位
                            {level.paths.length > 1 &&
                              ` · ${level.paths.length} 條路`}
                          </span>

                          {newEnemies.length > 0 && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                              新怪物：{newEnemies.join("、")}
                            </span>
                          )}

                          {stars === 0 && record > 0 && (
                            <span className="text-[11px] font-medium text-slate-400">
                              最佳紀錄：撐到第 {record} 波
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">
                          先通關「{LEVELS[index - 1].nameZh}」
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </main>

      {dexOpen && (
        <CharacterDex
          availableCharacterIds={availableIds}
          onClose={() => setDexOpen(false)}
        />
      )}
    </div>
  );
}

/** 存檔狀態。沒登入時講清楚進度只留在這台裝置。 */
function SyncBadge({
  status,
  isSignedIn,
}: {
  status: SyncStatus;
  isSignedIn: boolean;
}) {
  if (!isSignedIn) {
    return (
      <span className="mt-2 inline-block rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-medium text-amber-700">
        未登入 · 進度只存在這台裝置
      </span>
    );
  }

  const label: Record<SyncStatus, string> = {
    idle: "",
    loading: "讀取雲端進度…",
    saving: "儲存中…",
    saved: "進度已存到雲端",
    offline: "連不上雲端 · 進度先存在這台裝置",
  };

  if (!label[status]) return null;

  return (
    <span
      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
        status === "offline"
          ? "bg-amber-100/80 text-amber-700"
          : "bg-white/70 text-slate-500"
      }`}
    >
      {label[status]}
    </span>
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
        <span
          className="mt-0.5 flex gap-px"
          aria-label={`${stars} 顆星`}
        >
          {[0, 1, 2].map((index) => (
            <Star
              key={index}
              size={9}
              strokeWidth={0}
              aria-hidden="true"
              className={index < stars ? "fill-amber-400" : "fill-slate-200"}
            />
          ))}
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
