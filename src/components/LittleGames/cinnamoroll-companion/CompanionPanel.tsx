import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CompanionAction, CompanionAccessory, CompanionOutfit, CompanionSlot } from "../../../types/companion";
import { ACTIONS } from "./logic/actions";
import { ACCESSORIES } from "./logic/outfit";
import { useLanguage } from "../../../hooks/useLanguage";
import { T } from "../../common/T";

const SLOT_FILTERS = ["all", "head", "face", "neck", "hand"] as const;

export function CompanionPanel({ panel, outfit, onClose, onAction, onPat, onPreview, onClear }: {
  panel: "actions" | "outfit";
  outfit: CompanionOutfit;
  onClose: () => void;
  onAction: (action: CompanionAction) => void;
  onPat: () => void;
  onPreview: (id: CompanionAccessory) => void;
  onClear: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<CompanionSlot | "all">("all");
  const { t } = useLanguage();
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="companion-panel-title"
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[45dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border-hairline bg-background p-4 text-foreground shadow-xl backdrop:bg-black/15 sm:mx-auto sm:max-w-lg sm:rounded-t-2xl">
    <div className="flex items-center justify-between gap-3">
      <h2 id="companion-panel-title" className="text-lg font-semibold"><T k={panel === "actions" ? "gacha.companion.panel.actions" : "gacha.companion.panel.outfit"} variant="stacked" /></h2>
      <button type="button" onClick={onClose} aria-label={t("gacha.close")} className="btn btn-ghost min-h-11 min-w-11"><X size={20} /></button>
    </div>
    {panel === "actions" ? <div className="mt-3 grid grid-cols-3 gap-2">
      <button type="button" className="btn btn-outline min-h-11" onClick={onPat}><T k="gacha.companion.pat" variant="stacked" /></button>
      {ACTIONS.map(({ id }) => <button key={id} type="button" className="btn btn-outline min-h-11" onClick={() => onAction(id)}><T k={`gacha.companion.action.${id}`} variant="stacked" /></button>)}
    </div> : <>
      <p className="mb-3 text-sm text-muted-foreground"><T k="gacha.companion.outfitNote" /></p>
      <div role="group" aria-label={t("gacha.companion.slotGroup")} className="mb-3 flex flex-wrap gap-1">
        {SLOT_FILTERS.map((id) =>
          <button key={id} type="button" aria-pressed={filter === id} className={`btn min-h-11 ${filter === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(id)}><T k={`gacha.companion.slot.${id}`} variant="stacked" /></button>)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACCESSORIES.filter((item) => filter === "all" || item.slot === filter).map((item) => <button key={item.id} type="button"
          aria-pressed={outfit[item.slot] === item.id} onClick={() => onPreview(item.id)}
          className={`btn h-auto min-h-14 flex-col gap-0.5 py-2 ${outfit[item.slot] === item.id ? "btn-primary" : "btn-outline"}`}>
          <span><T k={`gacha.companion.accessory.${item.id}`} variant="stacked" /></span><span className="text-xs"><T k={outfit[item.slot] === item.id ? "gacha.companion.wearing" : "gacha.companion.tryOn"} /></span>
        </button>)}
      </div>
      <button type="button" className="btn btn-ghost mt-3 min-h-11" disabled={Object.keys(outfit).length === 0} onClick={onClear}><T k="gacha.companion.removeAll" variant="stacked" /></button>
    </>}
  </dialog>;
}
