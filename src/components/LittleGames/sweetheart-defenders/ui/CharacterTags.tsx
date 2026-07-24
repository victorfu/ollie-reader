import { ARCHETYPE_BY_ELEMENT, ARCHETYPE_LABEL_ZH, ELEMENT_COLOR } from "../data/elements";
import { TRAIT_LABEL_ZH } from "../data/traits";
import { getTrait } from "../engine/combat";
import type { TowerCharacter } from "../types";

/**
 * 打法 + 特性的標籤組。TowerPanel（戰鬥中選塔）與 SquadSelect（進關前選隊）
 * 都用它，讓同一隻角色在兩個畫面長得一樣。
 */
export function CharacterTags({ pet }: { pet: TowerCharacter }) {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const trait = getTrait(pet);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-800"
        style={{ backgroundColor: ELEMENT_COLOR[element] }}
      >
        {ARCHETYPE_LABEL_ZH[archetype]}
      </span>
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-inset ring-black/5"
        style={{
          // 特性的顏色取自副元素，一眼就看得出這隻的第二個元素是什麼。
          backgroundColor: `${ELEMENT_COLOR[pet.elements[1] ?? element]}55`,
        }}
      >
        {TRAIT_LABEL_ZH[trait]}
      </span>
    </div>
  );
}
