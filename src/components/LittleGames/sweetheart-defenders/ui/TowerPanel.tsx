import {
  ARCHETYPE_BY_ELEMENT,
  ARCHETYPE_DESC_ZH,
  ARCHETYPE_LABEL_ZH,
  ELEMENT_COLOR,
  ELEMENT_LABEL_ZH,
} from "../data/elements";
import { TRAIT_DESC_ZH, TRAIT_LABEL_ZH } from "../data/traits";
import { getTowerStats, getTrait } from "../engine/combat";
import { getPlaceCost, getSellRefund, getUpgradeCost } from "../engine/economy";
import { Candy, X } from "lucide-react";
import { playSfx } from "../audio";
import type { LiveTower, TowerCharacter } from "../types";

/** TowerPanel 只需要知道塔的等級，不需要冷卻、傷害那些每幀都在動的欄位。 */
type TowerSummary = Pick<LiveTower, "slotId" | "characterId" | "level">;

type Props = {
  tower: TowerSummary | undefined;
  pet: TowerCharacter | undefined;
  frosting: number;
  availableCharacters: TowerCharacter[];
  previewCharacterId: string | null;
  onPreviewCharacter: (characterId: string | null) => void;
  onPlace: (characterId: string) => void;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
};

/**
 * 點塔位後開的面板。
 *
 * 桌機放右側直欄、手機放底部——底部滿版在桌機會蓋住地圖下緣的塔位，那正是
 * 打到後面最需要看清楚的地方。
 */
export function TowerPanel({
  tower,
  pet,
  frosting,
  availableCharacters,
  previewCharacterId,
  onPreviewCharacter,
  onPlace,
  onUpgrade,
  onSell,
  onClose,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-3 lg:items-start">
      <div className="pointer-events-auto max-h-[52vh] w-full max-w-3xl overflow-y-auto rounded-[16px] border border-black/5 bg-white/92 p-3 shadow-[0_-8px_40px_rgba(150,110,130,0.22)] backdrop-blur-xl lg:max-h-full lg:w-72 lg:shadow-[0_8px_40px_rgba(150,110,130,0.22)]">
        {tower && pet ? (
          <OccupiedSlot
            tower={tower}
            pet={pet}
            frosting={frosting}
            onUpgrade={onUpgrade}
            onSell={onSell}
            onClose={onClose}
          />
        ) : (
          <EmptySlot
            frosting={frosting}
            availableCharacters={availableCharacters}
            previewCharacterId={previewCharacterId}
            onPreviewCharacter={onPreviewCharacter}
            onPlace={onPlace}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

/** 打法 + 特性的標籤組，兩個面板都會用到。 */
function PetTags({ pet }: { pet: TowerCharacter }) {
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

function PetDetails({ pet, level }: { pet: TowerCharacter; level: 1 | 2 | 3 }) {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const trait = getTrait(pet);
  const stats = getTowerStats(pet, level);

  return (
    <div className="mt-2 space-y-1.5 rounded-[10px] bg-slate-50/80 p-2">
      <p className="text-xs leading-snug text-slate-600">
        <span className="font-semibold text-slate-700">
          {ARCHETYPE_LABEL_ZH[archetype]}
        </span>
        {" · "}
        {ARCHETYPE_DESC_ZH[archetype]}
      </p>
      <p className="text-xs leading-snug text-slate-600">
        <span className="font-semibold text-slate-700">
          {TRAIT_LABEL_ZH[trait]}
        </span>
        {" · "}
        {TRAIT_DESC_ZH[trait]}
      </p>
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        <Metric label="屬性">{ELEMENT_LABEL_ZH[element]}</Metric>
        <Metric label="射程">{Math.round(stats.range)}</Metric>
        {stats.damage > 0 && (
          <Metric label="攻擊">{stats.damage.toFixed(1)}</Metric>
        )}
        {stats.cooldownMs > 0 && (
          <Metric label="間隔">{(stats.cooldownMs / 1000).toFixed(2)}s</Metric>
        )}
      </dl>
    </div>
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

function EmptySlot({
  frosting,
  availableCharacters,
  previewCharacterId,
  onPreviewCharacter,
  onPlace,
  onClose,
}: {
  frosting: number;
  availableCharacters: TowerCharacter[];
  previewCharacterId: string | null;
  onPreviewCharacter: (characterId: string | null) => void;
  onPlace: (characterId: string) => void;
  onClose: () => void;
}) {
  const preview = availableCharacters.find((candidate) => candidate.id === previewCharacterId);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {preview ? preview.nameZh : "選一隻角色站上這個位置"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-[8px] px-3 text-sm font-medium text-slate-500 transition hover:bg-black/5"
        >
          取消
        </button>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-start">
        {availableCharacters.map((candidate) => {
          const cost = getPlaceCost(candidate);
          const affordable = frosting >= cost;
          const isPreviewing = candidate.id === previewCharacterId;

          return (
            <button
              key={candidate.id}
              type="button"
              // 買不起的也要能點開來看——不然玩家在存到錢之前根本不知道這隻
              // 是幹嘛的，也就無從決定要不要存。只有「放上去」才擋。
              aria-disabled={!affordable}
              onPointerEnter={() => onPreviewCharacter(candidate.id)}
              onFocus={() => onPreviewCharacter(candidate.id)}
              onClick={() => {
                if (!isPreviewing) {
                  onPreviewCharacter(candidate.id);
                  return;
                }
                if (affordable) onPlace(candidate.id);
                else playSfx("denied");
              }}
              className={`flex w-[88px] shrink-0 flex-col items-center rounded-[12px] border p-1.5 transition ${
                isPreviewing
                  ? "border-[#ff6f9f] bg-rose-50 shadow-sm"
                  : "border-black/5 bg-white hover:bg-slate-50"
              } ${affordable ? "" : "opacity-55"}`}
            >
              <img
                src={candidate.sprite}
                alt={candidate.name}
                className="h-11 w-11 object-contain"
              />
              <span className="mt-0.5 text-[11px] font-medium leading-tight text-slate-700">
                {candidate.nameZh}
              </span>
              <div className="mt-1">
                <PetTags pet={candidate} />
              </div>
              <span
                className={`mt-1 flex items-center gap-0.5 text-[11px] font-semibold ${
                  affordable ? "text-amber-600" : "text-slate-400"
                }`}
              >
                <Candy size={12} strokeWidth={2} aria-hidden="true" />
                {cost}
              </span>
            </button>
          );
        })}
      </div>

      {preview && (
        <>
          <PetDetails pet={preview} level={1} />
          <button
            type="button"
            onClick={() => onPlace(preview.id)}
            disabled={frosting < getPlaceCost(preview)}
            className="mt-2 min-h-11 w-full rounded-[10px] bg-[#ff6f9f] text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-45"
          >
            <span className="flex items-center justify-center gap-1">
              {frosting < getPlaceCost(preview) ? "還差" : `放上 ${preview.nameZh}`}
              <Candy size={14} strokeWidth={2} aria-hidden="true" />
              {frosting < getPlaceCost(preview)
                ? getPlaceCost(preview) - frosting
                : getPlaceCost(preview)}
            </span>
          </button>
        </>
      )}
    </>
  );
}

function OccupiedSlot({
  tower,
  pet,
  frosting,
  onUpgrade,
  onSell,
  onClose,
}: {
  tower: TowerSummary;
  pet: TowerCharacter;
  frosting: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  const maxed = tower.level >= 3;
  const upgradeCost = maxed ? 0 : getUpgradeCost(pet, tower.level as 1 | 2);

  return (
    <>
      <div className="flex items-center gap-3">
        <img
          src={pet.sprite}
          alt={pet.name}
          className="h-14 w-14 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {pet.nameZh}
            <span className="text-xs font-medium text-slate-400">
              Lv.{tower.level}
            </span>
          </p>
          <div className="mt-1">
            <PetTags pet={pet} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 shrink-0 items-center rounded-[8px] px-2 text-slate-500 transition hover:bg-black/5"
          aria-label="關閉"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <PetDetails pet={pet} level={tower.level} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUpgrade}
          disabled={maxed || frosting < upgradeCost}
          className="min-h-11 flex-1 rounded-[10px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-45"
        >
          {maxed ? (
            "已滿級"
          ) : (
            <span className="flex items-center justify-center gap-1">
              升級
              <Candy size={14} strokeWidth={2} aria-hidden="true" />
              {upgradeCost}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onSell}
          className="min-h-11 rounded-[10px] border border-black/5 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          賣掉 +{getSellRefund(pet, tower.level)}
        </button>
      </div>
    </>
  );
}
