import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CompanionAction, CompanionAccessory, CompanionOutfit, CompanionSlot } from "../../../types/companion";
import { ACTIONS } from "./logic/actions";
import { ACCESSORIES } from "./logic/outfit";

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
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="companion-panel-title"
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[45dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border-hairline bg-background p-4 text-foreground shadow-xl backdrop:bg-black/15 sm:mx-auto sm:max-w-lg sm:rounded-t-2xl">
    <div className="flex items-center justify-between gap-3">
      <h2 id="companion-panel-title" className="text-lg font-semibold">{panel === "actions" ? "一起玩" : "換裝預覽"}</h2>
      <button type="button" onClick={onClose} aria-label="關閉" className="btn btn-ghost min-h-11 min-w-11"><X size={20} /></button>
    </div>
    {panel === "actions" ? <div className="mt-3 grid grid-cols-3 gap-2">
      <button type="button" className="btn btn-outline min-h-11" onClick={onPat}>摸摸頭</button>
      {ACTIONS.map(({ id, label }) => <button key={id} type="button" className="btn btn-outline min-h-11" onClick={() => onAction(id)}>{label}</button>)}
    </div> : <>
      <p className="mb-3 text-sm text-muted-foreground">免費試穿，不代表擁有；離開後不儲存。商店將於後續版本開放。</p>
      <div role="group" aria-label="配件分類" className="mb-3 flex flex-wrap gap-1">
        {([['all', '全部'], ['head', '頭飾'], ['face', '眼鏡'], ['neck', '頸部'], ['hand', '手持']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={filter === id} className={`btn min-h-11 ${filter === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACCESSORIES.filter((item) => filter === "all" || item.slot === filter).map((item) => <button key={item.id} type="button"
          aria-pressed={outfit[item.slot] === item.id} onClick={() => onPreview(item.id)}
          className={`btn h-auto min-h-14 flex-col gap-0.5 py-2 ${outfit[item.slot] === item.id ? "btn-primary" : "btn-outline"}`}>
          <span>{item.label}</span><span className="text-xs">{outfit[item.slot] === item.id ? "試穿中 · 點擊卸除" : "試穿"}</span>
        </button>)}
      </div>
      <button type="button" className="btn btn-ghost mt-3 min-h-11" disabled={Object.keys(outfit).length === 0} onClick={onClear}>全部卸除</button>
    </>}
  </dialog>;
}
