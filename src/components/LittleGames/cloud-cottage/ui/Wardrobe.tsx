import { useReducedMotion } from "framer-motion";
import { Check, LoaderCircle, Shirt, Sparkles, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import bellCollar from "../../../../assets/games/cloud-cottage/outfits/bell-collar.webp";
import blueScarf from "../../../../assets/games/cloud-cottage/outfits/blue-scarf.webp";
import flowerCrown from "../../../../assets/games/cloud-cottage/outfits/flower-crown.webp";
import goldenBow from "../../../../assets/games/cloud-cottage/outfits/golden-bow.webp";
import rainbowScarf from "../../../../assets/games/cloud-cottage/outfits/rainbow-scarf.webp";
import redRibbon from "../../../../assets/games/cloud-cottage/outfits/red-ribbon.webp";
import sailorHat from "../../../../assets/games/cloud-cottage/outfits/sailor-hat.webp";
import starHeadband from "../../../../assets/games/cloud-cottage/outfits/star-headband.webp";
import strawberryClip from "../../../../assets/games/cloud-cottage/outfits/strawberry-clip.webp";
import { OUTFITS } from "../data/outfits";
import type {
  PersonalizationAction,
} from "../logic/personalization";
import type {
  OutfitDefinition,
  OutfitId,
  OutfitSlot,
  PetSaveV1,
} from "../types";
import { PetAvatar } from "./PetAvatar";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const OUTFIT_IMAGE: Record<OutfitId, string> = {
  "strawberry-clip": strawberryClip,
  "sailor-hat": sailorHat,
  "flower-crown": flowerCrown,
  "star-headband": starHeadband,
  "red-ribbon": redRibbon,
  "blue-scarf": blueScarf,
  "bell-collar": bellCollar,
  "rainbow-scarf": rainbowScarf,
  "golden-bow": goldenBow,
};

type EquippedPreview = PetSaveV1["equipped"];

type WardrobeProps = {
  save: PetSaveV1;
  busy: boolean;
  onCancel: () => void;
  onPreviewChange?: (equipped: PetSaveV1["equipped"] | null) => void;
  onSave: (actions: PersonalizationAction[]) => Promise<void>;
};

type OutfitChoiceProps = {
  groupName: string;
  slot: OutfitSlot;
  outfit?: OutfitDefinition;
  selected: boolean;
  disabled: boolean;
  onChange: (slot: OutfitSlot, outfitId?: OutfitId) => void;
};

function getInitialEquipped(save: PetSaveV1): EquippedPreview {
  const equipped: EquippedPreview = {};
  for (const slot of ["head", "neck"] as const) {
    const outfitId = save.equipped[slot];
    const outfit = OUTFITS.find((candidate) => candidate.id === outfitId);
    if (
      outfitId &&
      outfit?.slot === slot &&
      save.inventory.outfits.includes(outfitId)
    ) {
      equipped[slot] = outfitId;
    }
  }
  return equipped;
}

function outfitName(outfitId: OutfitId | undefined, slot: OutfitSlot): string {
  if (!outfitId) return slot === "head" ? "不戴頭飾" : "不戴頸飾";
  return OUTFITS.find((outfit) => outfit.id === outfitId)?.nameZh ?? "不穿戴";
}

function OutfitChoice({
  groupName,
  slot,
  outfit,
  selected,
  disabled,
  onChange,
}: OutfitChoiceProps) {
  const optionId = outfit?.id ?? "none";
  const nameZh = outfit?.nameZh ?? (slot === "head" ? "不戴頭飾" : "不戴頸飾");
  const nameEn = outfit?.nameEn ?? "None";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.checked) onChange(slot, outfit?.id);
  };

  return (
    <label
      data-outfit-id={optionId}
      data-slot={slot}
      className={`group relative flex min-h-20 cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition-all focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 active:scale-[0.99] ${
        selected
          ? "border-sky-400 bg-sky-50 shadow-sky-100"
          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/55"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <input
        type="radio"
        name={groupName}
        value={optionId}
        checked={selected}
        disabled={disabled}
        onChange={handleChange}
        data-outfit-id={optionId}
        data-slot={slot}
        aria-checked={selected}
        className="peer sr-only"
      />
      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white bg-gradient-to-br from-sky-50 to-pink-50 shadow-inner">
        {outfit ? (
          <img
            src={OUTFIT_IMAGE[outfit.id]}
            alt=""
            className="h-[86%] w-[86%] select-none object-contain drop-shadow-sm"
            draggable={false}
          />
        ) : (
          <Shirt className="size-7 text-slate-300" strokeWidth={1.6} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-800">{nameZh}</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{nameEn}</span>
      </span>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          selected
            ? "border-sky-500 bg-sky-500 text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
        aria-hidden="true"
      >
        <Check className="size-4" strokeWidth={2.4} />
      </span>
    </label>
  );
}

function buildActions(
  previous: EquippedPreview,
  next: EquippedPreview,
): PersonalizationAction[] {
  const actions: PersonalizationAction[] = [];
  for (const slot of ["head", "neck"] as const) {
    if (previous[slot] === next[slot]) continue;
    const outfitId = next[slot];
    actions.push(
      outfitId
        ? { type: "equip-outfit", outfitId }
        : { type: "unequip-outfit", slot },
    );
  }
  return actions;
}

export function Wardrobe({
  save,
  busy,
  onCancel,
  onPreviewChange,
  onSave,
}: WardrobeProps) {
  const headGroupId = useId();
  const neckGroupId = useId();
  const titleId = useId();
  const helpId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const lockedRef = useRef(false);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [baseline, setBaseline] = useState<EquippedPreview>(() =>
    getInitialEquipped(save),
  );
  const [draft, setDraft] = useState<EquippedPreview>(() =>
    getInitialEquipped(save),
  );
  const [spinKey, setSpinKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState("可以開始試穿了。");
  const [saveError, setSaveError] = useState<string | null>(null);
  const locked = busy || submitting;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!lockedRef.current) {
          event.preventDefault();
          onCancelRef.current();
        }
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.tabIndex >= 0 && !element.hidden);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => returnFocus?.focus());
    };
  }, []);

  const ownedOutfits = OUTFITS.filter((outfit) =>
    save.inventory.outfits.includes(outfit.id),
  );
  const headOutfits = ownedOutfits.filter((outfit) => outfit.slot === "head");
  const neckOutfits = ownedOutfits.filter((outfit) => outfit.slot === "neck");
  const actions = buildActions(baseline, draft);
  const hasChanges = actions.length > 0;

  useEffect(() => {
    onPreviewChange?.(draft);
  }, [draft, onPreviewChange]);

  useEffect(
    () => () => onPreviewChange?.(null),
    [onPreviewChange],
  );

  const selectOutfit = (slot: OutfitSlot, outfitId?: OutfitId) => {
    if (locked || draft[slot] === outfitId) return;
    const next = { ...draft };
    if (outfitId) next[slot] = outfitId;
    else delete next[slot];
    setDraft(next);
    setSpinKey((key) => key + 1);
    setSaveError(null);
    setAnnouncement(
      `已預覽${slot === "head" ? "頭飾" : "頸飾"}：${outfitName(outfitId, slot)}。`,
    );
  };

  const handleSave = async () => {
    if (locked || actions.length === 0) return;
    setSubmitting(true);
    setSaveError(null);
    setAnnouncement("正在儲存穿搭。");
    try {
      await onSave(actions);
      setBaseline(draft);
      setAnnouncement("穿搭已儲存。");
    } catch {
      setSaveError("穿搭沒有儲存成功，請再試一次。");
      setAnnouncement("穿搭儲存失敗，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm sm:p-4"
      data-wardrobe
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={helpId}
        tabIndex={-1}
        className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#f7fbff] text-slate-800 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-[24px] sm:border sm:border-white/80"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-sky-100 bg-white/88 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Dress-up time</p>
            <h2 id={titleId} className="truncate text-xl font-black tracking-tight sm:text-2xl">
              衣櫥 Wardrobe
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            disabled={locked}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-sky-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="取消換裝並關閉衣櫥"
          >
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(390px,460px)] lg:overflow-hidden">
          <aside className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-white to-pink-50 px-5 py-6 lg:min-h-0 lg:border-r lg:border-sky-100 lg:px-10">
            <div className="pointer-events-none absolute -left-12 top-8 size-48 rounded-full bg-white/65 blur-2xl" />
            <div className="pointer-events-none absolute -right-10 bottom-2 size-44 rounded-full bg-pink-100/70 blur-2xl" />
            <span className="pointer-events-none absolute left-[12%] top-[16%] text-3xl opacity-65" aria-hidden="true">☁️</span>
            <span className="pointer-events-none absolute right-[12%] top-[24%] text-2xl opacity-65" aria-hidden="true">✨</span>

            <div className="relative flex w-full max-w-xl flex-col items-center">
              <div className="mb-1 flex flex-wrap justify-center gap-2 text-xs font-bold text-slate-600 sm:text-sm">
                <span className="rounded-full border border-white bg-white/80 px-3 py-1 shadow-sm">
                  頭飾 Head · {outfitName(draft.head, "head")}
                </span>
                <span className="rounded-full border border-white bg-white/80 px-3 py-1 shadow-sm">
                  頸飾 Neck · {outfitName(draft.neck, "neck")}
                </span>
              </div>
              <PetAvatar
                equipped={draft}
                action="idle"
                spinKey={spinKey}
                reducedMotion={prefersReducedMotion}
                className="mt-1 w-[min(70vw,360px)] max-w-[78%] lg:w-[min(30vw,430px)] lg:max-w-[88%]"
                imageClassName="drop-shadow-[0_22px_20px_rgba(62,118,155,0.22)]"
                alt="正在試穿配件的大耳狗喜拿"
              />
              <p id={helpId} className="mt-1 max-w-md text-center text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
                選擇配件會立即預覽；按下儲存後才會套用到小窩。
                <span className="ml-1 text-sky-600">Choose an item to preview.</span>
              </p>
            </div>
          </aside>

          <div className="space-y-6 px-4 py-5 lg:h-full lg:overflow-y-auto lg:px-6 lg:py-6">
            <fieldset disabled={locked}>
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span>
                  <span className="block text-base font-black text-slate-800">頭飾</span>
                  <span className="block text-xs font-semibold text-slate-500">Head accessories</span>
                </span>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-700">
                  {headOutfits.length} 件
                </span>
              </legend>
              <div role="radiogroup" aria-label="選擇頭飾" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <OutfitChoice
                  groupName={headGroupId}
                  slot="head"
                  selected={!draft.head}
                  disabled={locked}
                  onChange={selectOutfit}
                />
                {headOutfits.map((outfit) => (
                  <OutfitChoice
                    key={outfit.id}
                    groupName={headGroupId}
                    slot="head"
                    outfit={outfit}
                    selected={draft.head === outfit.id}
                    disabled={locked}
                    onChange={selectOutfit}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset disabled={locked}>
              <legend className="mb-3 flex w-full items-center justify-between gap-3">
                <span>
                  <span className="block text-base font-black text-slate-800">頸飾</span>
                  <span className="block text-xs font-semibold text-slate-500">Neck accessories</span>
                </span>
                <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-black text-pink-700">
                  {neckOutfits.length} 件
                </span>
              </legend>
              <div role="radiogroup" aria-label="選擇頸飾" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <OutfitChoice
                  groupName={neckGroupId}
                  slot="neck"
                  selected={!draft.neck}
                  disabled={locked}
                  onChange={selectOutfit}
                />
                {neckOutfits.map((outfit) => (
                  <OutfitChoice
                    key={outfit.id}
                    groupName={neckGroupId}
                    slot="neck"
                    outfit={outfit}
                    selected={draft.neck === outfit.id}
                    disabled={locked}
                    onChange={selectOutfit}
                  />
                ))}
              </div>
            </fieldset>

            {ownedOutfits.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-sky-200 bg-sky-50 px-4 py-4 text-center">
                <Sparkles className="mx-auto size-5 text-sky-500" aria-hidden="true" />
                <p className="mt-1 text-sm font-bold text-slate-700">到商店挑一件新配件吧！</p>
                <p className="mt-0.5 text-xs text-slate-500">Visit the shop to find an outfit.</p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-sky-100 bg-white/92 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6 sm:pb-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0" aria-hidden="true">
              <p className={`truncate text-xs font-bold ${saveError ? "text-red-600" : hasChanges ? "text-sky-700" : "text-slate-500"}`}>
                {saveError ?? (hasChanges ? `有 ${actions.length} 項變更尚未儲存` : "目前穿搭已儲存")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={locked}
                className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消 Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={locked || !hasChanges}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {locked ? (
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check className="size-4" strokeWidth={2.3} aria-hidden="true" />
                )}
                儲存 Save
              </button>
            </div>
          </div>
        </footer>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </section>
    </div>
  );
}
