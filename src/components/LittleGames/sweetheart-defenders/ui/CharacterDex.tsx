import { useEffect, useMemo, useState } from "react";
import { Candy, X } from "lucide-react";
import {
  ARCHETYPE_BY_ELEMENT,
  ARCHETYPE_LABEL_ZH,
  ELEMENT_COLOR,
  ELEMENT_LABEL_ZH,
} from "../data/elements";
import { CHARACTERS, DEFAULT_ROSTER_IDS } from "../data/characters";
import { TRAIT_DESC_ZH, TRAIT_LABEL_ZH } from "../data/traits";
import { getTowerStats, getTrait } from "../engine/combat";
import { RARITY_TIERS } from "../constants";
import type { TowerCharacter, Rarity } from "../types";

const RARITY_LABEL_ZH: Record<Rarity, string> = {
  common: "普通",
  uncommon: "少見",
  rare: "稀有",
  warden: "守護者",
  mythling: "傳說",
};

const RARITY_STYLE: Record<Rarity, string> = {
  common: "bg-slate-100 text-slate-600",
  uncommon: "bg-emerald-100 text-emerald-700",
  rare: "bg-sky-100 text-sky-700",
  warden: "bg-violet-100 text-violet-700",
  mythling: "bg-amber-100 text-amber-700",
};

const DEFAULTS = new Set(DEFAULT_ROSTER_IDS);

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

  // 跟聲音面板一樣，按 Esc 就收起來。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="關閉角色圖鑑"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/25 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-dex-title"
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[16px] border border-black/5 bg-white/90 shadow-2xl backdrop-blur-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="character-dex-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              角色圖鑑
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              已收集 {unlocked.size} / {CHARACTERS.length} · 抽到的角色都能放上塔位
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-black/5"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
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
        </div>

        {/* 詳細資料釘在底部而不是接在格子後面：57 個角色排下來，點了誰都要
            捲到最後才看得到說明，看起來就像點了沒反應。 */}
        {selected && (
          <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-black/5 bg-white/70 px-4 py-3">
            <CharacterDetail
              character={selected}
              unlocked={unlocked.has(selected.id)}
              isDefault={DEFAULTS.has(selected.id)}
            />
          </div>
        )}
      </div>
    </div>
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

function CharacterDetail({
  character,
  unlocked,
  isDefault,
}: {
  character: TowerCharacter;
  unlocked: boolean;
  isDefault: boolean;
}) {
  const element = character.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const trait = getTrait(character);
  const stats = getTowerStats(character, 1);

  return (
    <section className="rounded-[16px] border border-black/5 bg-white/90 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-4">
        <img
          src={character.sprite}
          alt={unlocked ? character.name : "還沒收集到的角色"}
          className={`h-20 w-20 shrink-0 object-contain ${
            unlocked ? "" : "opacity-35 brightness-0"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {unlocked ? character.nameZh : "？？？"}
            </h2>
            {unlocked && (
              <span className="text-xs font-medium text-slate-400">
                {character.name}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RARITY_STYLE[character.rarity]}`}
            >
              {RARITY_LABEL_ZH[character.rarity]}
            </span>
            {unlocked && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {isDefault ? "預設班底" : "扭蛋抽到的"}
              </span>
            )}
          </div>

          {unlocked ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-800"
                  style={{ backgroundColor: ELEMENT_COLOR[element] }}
                >
                  {ELEMENT_LABEL_ZH[element]} · {ARCHETYPE_LABEL_ZH[archetype]}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-black/5"
                  style={{
                    backgroundColor: `${ELEMENT_COLOR[character.elements[1] ?? element]}55`,
                  }}
                >
                  {TRAIT_LABEL_ZH[trait]}
                </span>
              </div>

              <p className="mt-2 text-sm leading-snug text-slate-600">
                {TRAIT_DESC_ZH[trait]}
              </p>

              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <Metric label="造價">
                  <span className="flex items-center gap-0.5">
                    <Candy size={12} strokeWidth={2} aria-hidden="true" />
                    {RARITY_TIERS[character.rarity].cost}
                  </span>
                </Metric>
                <Metric label="射程">{Math.round(stats.range)}</Metric>
                {stats.damage > 0 && (
                  <Metric label="攻擊">{stats.damage.toFixed(1)}</Metric>
                )}
                {stats.cooldownMs > 0 && (
                  <Metric label="間隔">
                    {(stats.cooldownMs / 1000).toFixed(2)}s
                  </Metric>
                )}
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              去「人氣角色扭蛋機」抽抽看，抽到就能放上塔位。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="opacity-70">{label}</dt>
      <dd className="font-semibold text-slate-600">{children}</dd>
    </div>
  );
}
