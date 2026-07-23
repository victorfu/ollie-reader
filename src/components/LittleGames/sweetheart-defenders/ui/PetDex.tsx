import { useMemo, useState } from "react";
import {
  ARCHETYPE_BY_ELEMENT,
  ARCHETYPE_LABEL_ZH,
  ELEMENT_COLOR,
  ELEMENT_LABEL_ZH,
} from "../data/elements";
import { PETS } from "../data/pets";
import { TRAIT_DESC_ZH, TRAIT_LABEL_ZH } from "../data/traits";
import { describeUnlockSource, unlockSourceFor } from "../data/unlocks";
import { getTowerStats, getTrait } from "../engine/combat";
import { RARITY_TIERS } from "../constants";
import type { Pet, Rarity } from "../types";

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

type Props = {
  unlockedPetIds: string[];
  onBack: () => void;
};

/**
 * 寵物圖鑑。
 *
 * 全部 48 隻都列出來，還沒拿到的顯示成剪影並寫清楚「怎麼拿」——看得到但還沒
 * 有，才會想去把那一關的三顆星補起來。
 */
export function PetDex({ unlockedPetIds, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const unlocked = useMemo(() => new Set(unlockedPetIds), [unlockedPetIds]);
  const selected = PETS.find((pet) => pet.id === selectedId);

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-y-auto px-4 py-8 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(255,200,224,0.5), transparent 42%), radial-gradient(circle at 82% 12%, rgba(198,222,255,0.45), transparent 38%), #fff7fb",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-20 min-h-11 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl sm:left-6 sm:top-6"
      >
        ← 回闖關路線
      </button>

      <header className="mt-10 flex flex-col items-center sm:mt-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          寵物圖鑑
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          已收集 {unlocked.size} / {PETS.length}
        </p>
      </header>

      <div className="mx-auto mt-6 grid w-full max-w-4xl grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {PETS.map((pet) => (
          <DexCard
            key={pet.id}
            pet={pet}
            unlocked={unlocked.has(pet.id)}
            selected={pet.id === selectedId}
            onSelect={() => setSelectedId(pet.id === selectedId ? null : pet.id)}
          />
        ))}
      </div>

      {selected && (
        <div className="mx-auto mt-4 w-full max-w-4xl">
          <PetDetail pet={selected} unlocked={unlocked.has(selected.id)} />
        </div>
      )}

      <div className="h-8 shrink-0" />
    </div>
  );
}

function DexCard({
  pet,
  unlocked,
  selected,
  onSelect,
}: {
  pet: Pet;
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
        src={pet.sprite}
        alt={unlocked ? pet.name : "還沒收集到的寵物"}
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
        {unlocked ? pet.nameZh : "？？？"}
      </span>
    </button>
  );
}

function PetDetail({ pet, unlocked }: { pet: Pet; unlocked: boolean }) {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const trait = getTrait(pet);
  const stats = getTowerStats(pet, 1);

  return (
    <section className="rounded-[16px] border border-black/5 bg-white/90 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-4">
        <img
          src={pet.sprite}
          alt={unlocked ? pet.name : "還沒收集到的寵物"}
          className={`h-20 w-20 shrink-0 object-contain ${
            unlocked ? "" : "opacity-35 brightness-0"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {unlocked ? pet.nameZh : "？？？"}
            </h2>
            {unlocked && (
              <span className="text-xs font-medium text-slate-400">
                {pet.name}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RARITY_STYLE[pet.rarity]}`}
            >
              {RARITY_LABEL_ZH[pet.rarity]}
            </span>
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
                    backgroundColor: `${ELEMENT_COLOR[pet.elements[1] ?? element]}55`,
                  }}
                >
                  {TRAIT_LABEL_ZH[trait]}
                </span>
              </div>

              <p className="mt-2 text-sm leading-snug text-slate-600">
                {TRAIT_DESC_ZH[trait]}
              </p>

              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <Metric label="造價">🍬 {RARITY_TIERS[pet.rarity].cost}</Metric>
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
              取得方式：{describeUnlockSource(unlockSourceFor(pet.id))}
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
