import { useState } from "react";
import {
  ArrowLeft,
  Candy,
  Check,
  Crosshair,
  Eraser,
  Info,
  Sparkles,
  Swords,
} from "lucide-react";
import { playSfx } from "../audio";
import { MAX_SQUAD_SIZE } from "../constants";
import { getTowerStats } from "../engine/combat";
import { getPlaceCost } from "../engine/economy";
import { recommendSquad } from "../squad";
import type { TowerCharacter } from "../types";
import { CharacterDetail, RangeMeter } from "./CharacterDetail";
import { CharacterTags } from "./CharacterTags";
import { Popup } from "./Popup";

type Props = {
  levelName: string;
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
  const [detailId, setDetailId] = useState<string | null>(null);

  const isFull = squadIds.length >= MAX_SQUAD_SIZE;
  const detail = availableCharacters.find(
    (character) => character.id === detailId,
  );

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
          {levelName}
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
      <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
        粉紅色長條是攻擊範圍，點
        <Info size={12} strokeWidth={2} aria-hidden="true" />
        看招式細節
      </p>

      <div className="mx-auto mt-5 grid w-full max-w-4xl grid-cols-3 gap-2 pb-28 sm:grid-cols-5 lg:grid-cols-6">
        {availableCharacters.map((character) => {
          const picked = squadIds.includes(character.id);
          const range = Math.round(getTowerStats(character, 1).range);

          // 卡片本身是「選進隊伍」，ⓘ 是「看細節」——兩顆按鈕不能互相巢狀，
          // 所以外面包一層 div 而不是把 ⓘ 塞進卡片按鈕裡。
          return (
            <div key={character.id} className="relative">
              <button
                type="button"
                onClick={() => toggle(character.id)}
                aria-pressed={picked}
                className={`flex w-full flex-col items-center rounded-[12px] border p-1.5 shadow-sm transition ${
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
                <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold">
                  <span className="flex items-center gap-0.5 text-amber-600">
                    <Candy size={12} strokeWidth={2} aria-hidden="true" />
                    {getPlaceCost(character)}
                  </span>
                  <span className="flex items-center gap-0.5 text-slate-500">
                    <Crosshair size={12} strokeWidth={2} aria-hidden="true" />
                    {range}
                  </span>
                </span>
                <RangeMeter range={range} className="mt-1" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playSfx("select");
                  setDetailId(character.id);
                }}
                aria-haspopup="dialog"
                aria-label={`看 ${character.nameZh} 的招式細節`}
                className="absolute left-0.5 top-0.5 flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/5 hover:text-slate-600"
              >
                <Info size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {detail && (
        <Popup
          title="招式細節"
          panelClassName="max-w-lg"
          onClose={() => setDetailId(null)}
          // 看完就能直接決定要不要帶，不用關掉面板再回去清單裡找同一張卡。
          footer={
            <div className="shrink-0 border-t border-black/5 bg-white/70 p-3">
              <button
                type="button"
                disabled={isFull && !squadIds.includes(detail.id)}
                onClick={() => {
                  toggle(detail.id);
                  setDetailId(null);
                }}
                className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold shadow-sm transition disabled:opacity-45 ${
                  squadIds.includes(detail.id)
                    ? "border border-[#ff6f9f]/40 bg-white text-[#d94f7d] hover:bg-rose-50"
                    : "bg-[#ff6f9f] text-white hover:brightness-105"
                }`}
              >
                {squadIds.includes(detail.id)
                  ? "請下場"
                  : isFull
                    ? "隊伍滿了"
                    : "選入隊伍"}
              </button>
            </div>
          }
        >
          <CharacterDetail character={detail} />
        </Popup>
      )}

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
