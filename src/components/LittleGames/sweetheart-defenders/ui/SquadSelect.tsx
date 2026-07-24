import { useState } from "react";
import { ArrowLeft, Candy, Check, Eraser, Sparkles, Swords } from "lucide-react";
import { playSfx } from "../audio";
import { MAX_SQUAD_SIZE } from "../constants";
import { getPlaceCost } from "../engine/economy";
import { recommendSquad } from "../squad";
import type { Difficulty, TowerCharacter } from "../types";
import { CharacterTags } from "./CharacterTags";

const DIFFICULTY_LABEL_ZH: Record<Difficulty, string> = {
  easy: "輕鬆",
  normal: "普通",
  hard: "挑戰",
};

type Props = {
  levelName: string;
  difficulty: Difficulty;
  /** 已擁有的角色（預設班底 ∪ 扭蛋收藏），照 CHARACTERS 順序 */
  availableCharacters: TowerCharacter[];
  /** 上次帶的隊伍（已 sanitize），空陣列表示第一次玩 */
  initialSquadIds: string[];
  onStart: (squadIds: string[]) => void;
  onBack: () => void;
};

/**
 * 進關前的選隊畫面：從收藏裡挑最多 MAX_SQUAD_SIZE 種角色帶進這一場。
 *
 * 收藏全上陣的話，佈塔面板會長到要一直捲，「賽前搭配」也就不存在了；
 * 隊伍上限逼玩家在八種打法之間做取捨，這正是塔防好玩的那一半。
 */
export function SquadSelect({
  levelName,
  difficulty,
  availableCharacters,
  initialSquadIds,
  onStart,
  onBack,
}: Props) {
  // 第一次玩（沒有存過隊伍）直接給一隊打法齊全的推薦，按「出發」就能玩。
  const [squadIds, setSquadIds] = useState<string[]>(() =>
    initialSquadIds.length > 0
      ? initialSquadIds
      : recommendSquad(availableCharacters, []),
  );

  const isFull = squadIds.length >= MAX_SQUAD_SIZE;

  const toggle = (id: string) => {
    if (squadIds.includes(id)) {
      playSfx("select");
      setSquadIds(squadIds.filter((memberId) => memberId !== id));
      return;
    }
    if (isFull) {
      playSfx("denied");
      return;
    }
    playSfx("select");
    setSquadIds([...squadIds, id]);
  };

  const autoFill = () => {
    playSfx("select");
    setSquadIds(recommendSquad(availableCharacters, squadIds));
  };

  const clear = () => {
    playSfx("sell");
    setSquadIds([]);
  };

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-y-auto px-4 pt-8 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.5), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.45), transparent 38%), #fff7fb",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-20 flex min-h-11 items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        回闖關路線
      </button>

      <header className="mt-10 flex flex-col items-center sm:mt-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          出戰隊伍
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {levelName} · {DIFFICULTY_LABEL_ZH[difficulty]}
        </p>
      </header>

      {/* 五個隊伍欄位。點已上場的角色可以直接請下場。 */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {Array.from({ length: MAX_SQUAD_SIZE }, (_, index) => {
          const member = availableCharacters.find(
            (character) => character.id === squadIds[index],
          );

          return member ? (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              aria-label={`把 ${member.nameZh} 請下場`}
              className="flex size-14 items-center justify-center rounded-full border-2 border-[#ff6f9f] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <img
                src={member.sprite}
                alt=""
                className="size-11 object-contain"
              />
            </button>
          ) : (
            <span
              key={`empty-${index}`}
              aria-hidden="true"
              className="size-14 rounded-full border-2 border-dashed border-slate-300 bg-white/40"
            />
          );
        })}
      </div>

      <p className="mt-2 text-center text-xs text-slate-500">
        {isFull
          ? "隊伍滿了，想換人就先點掉上面的一位"
          : `還可以帶 ${MAX_SQUAD_SIZE - squadIds.length} 位`}
      </p>

      <div className="mx-auto mt-5 grid w-full max-w-4xl grid-cols-3 gap-2 pb-28 sm:grid-cols-5 lg:grid-cols-6">
        {availableCharacters.map((character) => {
          const picked = squadIds.includes(character.id);

          return (
            <button
              key={character.id}
              type="button"
              onClick={() => toggle(character.id)}
              aria-pressed={picked}
              className={`relative flex flex-col items-center rounded-[12px] border p-1.5 shadow-sm transition ${
                picked
                  ? "border-[#ff6f9f] bg-rose-50 ring-2 ring-[#ff6f9f]/25"
                  : "border-black/5 bg-white/80 hover:-translate-y-0.5 hover:shadow-md"
              } ${!picked && isFull ? "opacity-55" : ""}`}
            >
              {picked && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[#ff6f9f] text-white"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <img
                src={character.sprite}
                alt={character.name}
                className="h-12 w-12 object-contain"
              />
              <span className="mt-0.5 text-center text-[11px] font-medium leading-tight text-slate-700">
                {character.nameZh}
              </span>
              <div className="mt-1">
                <CharacterTags pet={character} />
              </div>
              <span className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold text-amber-600">
                <Candy size={12} strokeWidth={2} aria-hidden="true" />
                {getPlaceCost(character)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 固定在底部的行動列：清單再長，出發鍵都在手邊。 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-[16px] border border-black/5 bg-white/90 p-2 shadow-[0_8px_40px_rgba(150,110,130,0.25)] backdrop-blur-xl">
          <button
            type="button"
            onClick={autoFill}
            disabled={isFull}
            className="flex min-h-11 items-center gap-1 rounded-[10px] border border-black/5 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-45"
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
            推薦
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={squadIds.length === 0}
            className="flex min-h-11 items-center gap-1 rounded-[10px] border border-black/5 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-45"
          >
            <Eraser size={15} strokeWidth={2} aria-hidden="true" />
            清空
          </button>
          <button
            type="button"
            onClick={() => onStart(squadIds)}
            disabled={squadIds.length === 0}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-45"
          >
            <Swords size={16} strokeWidth={2} aria-hidden="true" />
            出發（{squadIds.length} / {MAX_SQUAD_SIZE}）
          </button>
        </div>
      </div>
    </div>
  );
}
