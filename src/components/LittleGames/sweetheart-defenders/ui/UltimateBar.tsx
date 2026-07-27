import { ARCHETYPE_BY_ELEMENT, ELEMENT_COLOR } from "../data/elements";
import { ULTIMATES } from "../data/ultimates";
import type { TowerCharacter } from "../types";

type Props = {
  /** 這一場帶進來的隊伍，照選隊順序 */
  squad: TowerCharacter[];
  /** 已經站上塔位的角色 id */
  placed: Set<string>;
  /** characterId → 0–1 */
  charge: Record<string, number>;
  onCast: (characterId: string) => void;
};

/**
 * 畫面底部的絕招列。
 *
 * 大招做成「點畫面上發光的那座塔」對小朋友太難——塔很小、又會被怪蓋住，而且
 * 同一個角色放三座時根本不知道要點哪一座。改成固定在底部的一排頭像：位置永遠
 * 一樣、目標夠大，充滿了就發光跳一下，點下去那個角色的所有塔一起放招。
 *
 * 還沒上場的角色顯示成灰的，順便當作「這場帶了誰」的提醒。
 */
export function UltimateBar({ squad, placed, charge, onCast }: Props) {
  if (squad.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-3">
      <div className="pointer-events-auto flex items-end gap-2 rounded-[18px] border border-black/5 bg-white/85 p-2 shadow-[0_8px_32px_rgba(150,110,130,0.22)] backdrop-blur-xl">
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
