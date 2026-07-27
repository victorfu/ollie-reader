import { useMemo, useState } from "react";
import { CHARACTERS } from "../data/characters";
import { CharacterDetail } from "./CharacterDetail";
import { Popup } from "./Popup";
import type { TowerCharacter } from "../types";

type Props = {
  availableCharacterIds: string[];
  onClose: () => void;
};

/**
 * 角色圖鑑。
 *
 * 57 個扭蛋角色全部列出來，還沒收集到的顯示成剪影——看得到但還沒有，才會想
 * 去扭蛋機碰運氣。已收集的顯示打法、特性與數值，那是扭蛋機的收藏頁沒有、
 * 但決定「這場要放誰」時真正需要的資訊。
 *
 * 做成彈出面板而不是獨立畫面：圖鑑是「看一眼就回去挑關卡」的東西，
 * 整頁切走再切回來會把闖關路線的位置和捲動都洗掉。
 */
export function CharacterDex({ availableCharacterIds, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const unlocked = useMemo(
    () => new Set(availableCharacterIds),
    [availableCharacterIds],
  );
  const selected = CHARACTERS.find((character) => character.id === selectedId);

  return (
    <Popup
      title="角色圖鑑"
      subtitle={`已收集 ${unlocked.size} / ${CHARACTERS.length} · 抽到的角色都能放上塔位`}
      onClose={onClose}
      // 詳細資料釘在底部而不是接在格子後面：57 個角色排下來，點了誰都要
      // 捲到最後才看得到說明，看起來就像點了沒反應。
      footer={
        selected && (
          <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-black/5 bg-white/70 px-4 py-3">
            <CharacterDetail
              character={selected}
              unlocked={unlocked.has(selected.id)}
            />
          </div>
        )
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {CHARACTERS.map((character) => (
          <DexCard
            key={character.id}
            character={character}
            unlocked={unlocked.has(character.id)}
            selected={character.id === selectedId}
            onSelect={() => setSelectedId(character.id === selectedId ? null : character.id)}
          />
        ))}
      </div>
    </Popup>
  );
}

function DexCard({
  character,
  unlocked,
  selected,
  onSelect,
}: {
  character: TowerCharacter;
  unlocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center rounded-[12px] border p-1.5 shadow-sm transition ${
        selected
          ? "border-[#ff6f9f] bg-white ring-2 ring-[#ff6f9f]/25"
          : "border-black/5 bg-white/80 hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <img
        src={character.sprite}
        alt={unlocked ? character.name : "還沒收集到的角色"}
        className={`h-12 w-12 object-contain transition ${
          // 還沒拿到就壓成剪影：看得出輪廓，但看不出是誰。
          unlocked ? "" : "opacity-35 brightness-0"
        }`}
      />
      <span
        className={`mt-0.5 text-center text-[10px] font-medium leading-tight ${
          unlocked ? "text-slate-700" : "text-slate-400"
        }`}
      >
        {unlocked ? character.nameZh : "？？？"}
      </span>
    </button>
  );
}
