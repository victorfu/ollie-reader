import { Heart } from "lucide-react";
import { ARCHETYPE_BY_ELEMENT, ELEMENT_COLOR } from "../data/elements";
import { TEAM_ULTIMATE, ULTIMATES } from "../data/ultimates";
import type { TowerCharacter } from "../types";

type Props = {
  /** 這一場帶進來的隊伍，照選隊順序 */
  squad: TowerCharacter[];
  /** 已經站上塔位的角色 id */
  placed: Set<string>;
  /** characterId → 0–1 */
  charge: Record<string, number>;
  /** 隊伍大絕招充能 0–1 */
  teamCharge: number;
  onCast: (characterId: string) => void;
  onCastTeam: () => void;
};

/**
 * 畫面底部的絕招列。
 *
 * 大招做成「點畫面上發光的那座塔」對小朋友太難——塔很小、又會被怪蓋住，而且
 * 同一個角色放三座時根本不知道要點哪一座。改成固定在底部的一排頭像：位置永遠
 * 一樣、目標夠大，充滿了就發光跳一下，點下去那個角色的所有塔一起放招。
 *
 * 還沒上場的角色顯示成灰的，順便當作「這場帶了誰」的提醒。
 *
 * 最左邊那顆愛心是隊伍大絕招：放旁邊任何一顆角色絕招它就漲一格，集滿按下去
 * 全隊攻擊整張地圖。擺在同一排的理由跟上面一樣——位置固定、目標夠大。
 */
export function UltimateBar({
  squad,
  placed,
  charge,
  teamCharge,
  onCast,
  onCastTeam,
}: Props) {
  if (squad.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-3">
      <div className="pointer-events-auto flex items-end gap-2 rounded-[18px] border border-black/5 bg-white/85 p-2 shadow-[0_8px_32px_rgba(150,110,130,0.22)] backdrop-blur-xl">
        <TeamUltimateButton
          charge={teamCharge}
          anyOnField={placed.size > 0}
          onCast={onCastTeam}
        />
        {squad.map((character) => (
          <UltimateButton
            key={character.id}
            character={character}
            onField={placed.has(character.id)}
            charge={charge[character.id] ?? 0}
            onCast={() => onCast(character.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TeamUltimateButton({
  charge,
  anyOnField,
  onCast,
}: {
  charge: number;
  anyOnField: boolean;
  onCast: () => void;
}) {
  const ready = anyOnField && charge >= 1;

  return (
    <button
      type="button"
      onClick={onCast}
      disabled={!ready}
      aria-label={`隊伍大絕招「${TEAM_ULTIMATE.nameZh}」${
        ready ? "已就緒" : `充能 ${Math.round(charge * 100)}%`
      }`}
      title={`${TEAM_ULTIMATE.nameZh}：${TEAM_ULTIMATE.descZh}`}
      className={`relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 transition sm:size-16 ${
        ready
          ? "border-[#ff6f9f] bg-gradient-to-b from-[#ffd3e2] to-[#ff9ebd] shadow-[0_0_0_4px_rgba(255,111,159,0.35)] hover:-translate-y-1 active:scale-95 motion-safe:animate-pulse"
          : "border-black/10 bg-white/70"
      }`}
    >
      {/* 充能環跟角色鈕同一套畫法，一眼看得出「這也是會充能的鈕」。 */}
      <span
        aria-hidden="true"
        className="absolute inset-[-3px] rounded-full"
        style={{
          background: `conic-gradient(#ff6f9f ${Math.min(1, charge) * 360}deg, transparent 0deg)`,
          opacity: 0.9,
          mask: "radial-gradient(circle, transparent 62%, #000 64%)",
          WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%)",
        }}
      />

      <Heart
        aria-hidden="true"
        className={`size-7 sm:size-8 ${ready ? "text-white" : "text-[#ff9ebd]"}`}
        fill="currentColor"
        strokeWidth={1.5}
      />

      {ready && (
        <span className="absolute -bottom-1 whitespace-nowrap rounded-full bg-[#ff6f9f] px-1.5 text-[10px] font-bold text-white shadow-sm">
          {TEAM_ULTIMATE.nameZh}
        </span>
      )}
    </button>
  );
}

function UltimateButton({
  character,
  onField,
  charge,
  onCast,
}: {
  character: TowerCharacter;
  onField: boolean;
  charge: number;
  onCast: () => void;
}) {
  const archetype = ARCHETYPE_BY_ELEMENT[character.elements[0]];
  const ultimate = ULTIMATES[archetype];
  const ready = onField && charge >= 1;
  const color = ELEMENT_COLOR[character.elements[0]];

  return (
    <button
      type="button"
      onClick={onCast}
      disabled={!ready}
      aria-label={
        onField
          ? `${character.nameZh} 的絕招「${ultimate.nameZh}」${ready ? "已就緒" : `充能 ${Math.round(charge * 100)}%`}`
          : `${character.nameZh} 還沒上場`
      }
      title={`${ultimate.nameZh}：${ultimate.descZh}`}
      className={`relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 transition sm:size-16 ${
        ready
          ? "border-[#ff6f9f] bg-white shadow-[0_0_0_4px_rgba(255,111,159,0.25)] hover:-translate-y-1 active:scale-95 motion-safe:animate-pulse"
          : "border-black/10 bg-white/70"
      } ${onField ? "" : "opacity-40 grayscale"}`}
    >
      {/* 充能環：用 conic-gradient 畫一圈，滿了就整圈是主元素的顏色。 */}
      <span
        aria-hidden="true"
        className="absolute inset-[-3px] rounded-full"
        style={{
          background: `conic-gradient(${color} ${Math.min(1, charge) * 360}deg, transparent 0deg)`,
          opacity: onField ? 0.9 : 0.25,
          mask: "radial-gradient(circle, transparent 62%, #000 64%)",
          WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%)",
        }}
      />

      <img
        src={character.sprite}
        alt=""
        className="size-10 object-contain sm:size-12"
      />

      {ready && (
        <span className="absolute -bottom-1 rounded-full bg-[#ff6f9f] px-1.5 text-[10px] font-bold text-white shadow-sm">
          {ultimate.nameZh}
        </span>
      )}
    </button>
  );
}
