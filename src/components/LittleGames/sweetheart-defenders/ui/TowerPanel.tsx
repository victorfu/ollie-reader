import {
  ARCHETYPE_BY_ELEMENT,
  ARCHETYPE_DESC_ZH,
  ARCHETYPE_LABEL_ZH,
  ELEMENT_COLOR,
  ELEMENT_LABEL_ZH,
} from "../data/elements";
import { getPlaceCost, getSellRefund, getUpgradeCost } from "../engine/economy";
import type { LiveTower, Pet } from "../types";

/** TowerPanel 只需要知道塔的等級，不需要冷卻、傷害那些每幀都在動的欄位。 */
type TowerSummary = Pick<LiveTower, "slotId" | "petId" | "level">;

type Props = {
  tower: TowerSummary | undefined;
  pet: Pet | undefined;
  frosting: number;
  availablePets: Pet[];
  previewPetId: string | null;
  onPreviewPet: (petId: string | null) => void;
  onPlace: (petId: string) => void;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
};

/**
 * 點塔位後從底部滑出的面板。空塔位顯示可以放的寵物，有塔則顯示升級與賣出。
 * 用 sheet 而不是彈窗，手機上比較好按，桌機也不會擋住地圖中央。
 */
export function TowerPanel({
  tower,
  pet,
  frosting,
  availablePets,
  previewPetId,
  onPreviewPet,
  onPlace,
  onUpgrade,
  onSell,
  onClose,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3">
      <div className="pointer-events-auto w-full max-w-3xl rounded-[16px] border border-black/5 bg-white/90 p-3 shadow-[0_-8px_40px_rgba(150,110,130,0.22)] backdrop-blur-xl">
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
            availablePets={availablePets}
            previewPetId={previewPetId}
            onPreviewPet={onPreviewPet}
            onPlace={onPlace}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function EmptySlot({
  frosting,
  availablePets,
  previewPetId,
  onPreviewPet,
  onPlace,
  onClose,
}: {
  frosting: number;
  availablePets: Pet[];
  previewPetId: string | null;
  onPreviewPet: (petId: string | null) => void;
  onPlace: (petId: string) => void;
  onClose: () => void;
}) {
  const preview = availablePets.find((candidate) => candidate.id === previewPetId);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">
          {preview
            ? `${preview.nameZh} · ${ARCHETYPE_LABEL_ZH[ARCHETYPE_BY_ELEMENT[preview.elements[0]]]}`
            : "選一隻寵物站上這個位置"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-[8px] px-3 text-sm font-medium text-slate-500 transition hover:bg-black/5"
        >
          取消
        </button>
      </div>

      {preview && (
        <p className="mb-2 text-xs text-slate-500">
          {ARCHETYPE_DESC_ZH[ARCHETYPE_BY_ELEMENT[preview.elements[0]]]}
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {availablePets.map((candidate) => {
          const cost = getPlaceCost(candidate);
          const affordable = frosting >= cost;
          const element = candidate.elements[0];
          const isPreviewing = candidate.id === previewPetId;

          return (
            <button
              key={candidate.id}
              type="button"
              disabled={!affordable}
              onPointerEnter={() => onPreviewPet(candidate.id)}
              onFocus={() => onPreviewPet(candidate.id)}
              onClick={() =>
                isPreviewing ? onPlace(candidate.id) : onPreviewPet(candidate.id)
              }
              className={`flex w-[92px] shrink-0 flex-col items-center rounded-[12px] border p-2 transition ${
                isPreviewing
                  ? "border-[#ff6f9f] bg-rose-50 shadow-sm"
                  : "border-black/5 bg-white hover:bg-slate-50"
              } ${affordable ? "" : "cursor-not-allowed opacity-45"}`}
            >
              <img
                src={candidate.sprite}
                alt={candidate.name}
                className="h-12 w-12 object-contain"
              />
              <span className="mt-1 text-[11px] font-medium leading-tight text-slate-700">
                {candidate.nameZh}
              </span>
              <span
                className="mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-800"
                style={{ backgroundColor: ELEMENT_COLOR[element] }}
              >
                {ARCHETYPE_LABEL_ZH[ARCHETYPE_BY_ELEMENT[element]]}
              </span>
              <span className="mt-1 text-[11px] font-semibold text-amber-600">
                🍬 {cost}
              </span>
            </button>
          );
        })}
      </div>

      {preview && (
        <button
          type="button"
          onClick={() => onPlace(preview.id)}
          disabled={frosting < getPlaceCost(preview)}
          className="mt-2 min-h-11 w-full rounded-[10px] bg-[#ff6f9f] text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99] disabled:opacity-45"
        >
          放上 {preview.nameZh}（🍬 {getPlaceCost(preview)}）
        </button>
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
  pet: Pet;
  frosting: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  const element = pet.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const maxed = tower.level >= 3;
  const upgradeCost = maxed ? 0 : getUpgradeCost(pet, tower.level as 1 | 2);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <img
        src={pet.sprite}
        alt={pet.name}
        className="h-14 w-14 shrink-0 object-contain"
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {pet.nameZh}
          <span className="text-xs font-medium text-slate-400">Lv.{tower.level}</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-800"
            style={{ backgroundColor: ELEMENT_COLOR[element] }}
          >
            {ELEMENT_LABEL_ZH[element]} · {ARCHETYPE_LABEL_ZH[archetype]}
          </span>
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {ARCHETYPE_DESC_ZH[archetype]}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUpgrade}
          disabled={maxed || frosting < upgradeCost}
          className="min-h-11 rounded-[10px] bg-[#ff6f9f] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-45"
        >
          {maxed ? "已滿級" : `升級（🍬 ${upgradeCost}）`}
        </button>
        <button
          type="button"
          onClick={onSell}
          className="min-h-11 rounded-[10px] border border-black/5 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          賣掉 +{getSellRefund(pet, tower.level)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-[10px] px-3 text-sm font-medium text-slate-500 transition hover:bg-black/5"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
