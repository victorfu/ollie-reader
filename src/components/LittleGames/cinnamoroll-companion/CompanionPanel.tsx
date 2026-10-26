import { useEffect, useRef, useState } from "react";
import { Coins, X } from "lucide-react";
import type { CompanionAction, CompanionAccessory, CompanionSlot } from "../../../types/companion";
import { ACTIONS } from "./logic/actions";
import { ACCESSORIES, shownOutfit, type OutfitView } from "./logic/outfit";
import type { CompanionWardrobeState } from "./useCompanionWardrobe";
import { useLanguage } from "../../../hooks/useLanguage";
import type { MessageKey } from "../../../i18n/translate";
import { T } from "../../common/T";

const SLOT_FILTERS = ["all", "head", "face", "neck", "hand"] as const;
export type CompanionPanelKind = "actions" | "outfit" | "shop";

const TITLES: Record<CompanionPanelKind, MessageKey> = {
  actions: "gacha.companion.panel.actions",
  outfit: "gacha.companion.panel.outfit",
  shop: "gacha.companion.panel.shop",
};

function shopStatus(shop: CompanionWardrobeState): MessageKey | null {
  if (shop.status === "guest") return "gacha.companion.shop.guest";
  if (shop.status === "error") return "gacha.companion.shop.loadFailed";
  if (shop.status === "loading" || shop.balance === null) return "gacha.companion.shop.loading";
  if (!shop.online) return "gacha.companion.shop.offline";
  return null;
}

/** What tapping an accessory does: owned ones are worn, others only tried on. */
function wearLabel(owned: boolean, shown: boolean): MessageKey {
  if (owned) return shown ? "gacha.companion.wearing" : "gacha.companion.wear";
  return shown ? "gacha.companion.trying" : "gacha.companion.tryOn";
}

export function CompanionPanel({ panel, view, shop, message, onClose, onAction, onPat, onWear, onClear, onBuy }: {
  panel: CompanionPanelKind;
  view: OutfitView;
  shop: CompanionWardrobeState;
  /** The latest purchase result, announced in the shop. */
  message: MessageKey | null;
  onClose: () => void;
  onAction: (action: CompanionAction) => void;
  onPat: () => void;
  onWear: (id: CompanionAccessory) => void;
  onClear: () => void;
  onBuy: (id: CompanionAccessory) => void;
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
  const outfit = shownOutfit(view);
  const owned = shop.wardrobe.owned;
  const items = ACCESSORIES.filter((item) => filter === "all" || item.slot === filter);
  const filters = <div role="group" aria-label={t("gacha.companion.slotGroup")} className="mb-3 flex flex-wrap gap-1">
    {SLOT_FILTERS.map((id) =>
      <button key={id} type="button" aria-pressed={filter === id} className={`btn min-h-11 ${filter === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(id)}><T k={`gacha.companion.slot.${id}`} variant="stacked" /></button>)}
  </div>;
  const status = shopStatus(shop);
  const canBuy = status === null && shop.buying === null;

  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="companion-panel-title"
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[45dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border-hairline bg-background p-4 text-foreground shadow-xl backdrop:bg-black/15 sm:mx-auto sm:max-w-lg sm:rounded-t-2xl">
    <div className="flex items-center justify-between gap-3">
      <h2 id="companion-panel-title" className="text-lg font-semibold"><T k={TITLES[panel]} variant="stacked" /></h2>
      <button type="button" onClick={onClose} aria-label={t("gacha.close")} className="btn btn-ghost min-h-11 min-w-11"><X size={20} /></button>
    </div>
    {panel === "actions" ? <div className="mt-3 grid grid-cols-3 gap-2">
      <button type="button" className="btn btn-outline min-h-11" onClick={onPat}><T k="gacha.companion.pat" variant="stacked" /></button>
      {ACTIONS.map(({ id }) => <button key={id} type="button" className="btn btn-outline min-h-11" onClick={() => onAction(id)}><T k={`gacha.companion.action.${id}`} variant="stacked" /></button>)}
    </div> : null}
    {panel === "outfit" ? <>
      <p className="mb-3 text-sm text-muted-foreground"><T k={shop.status === "guest" ? "gacha.companion.outfitGuestNote" : "gacha.companion.outfitNote"} /></p>
      {filters}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const shown = outfit[item.slot] === item.id;
          return <button key={item.id} type="button" aria-pressed={shown} onClick={() => onWear(item.id)}
            className={`btn h-auto min-h-14 flex-col gap-0.5 py-2 ${shown ? "btn-primary" : "btn-outline"}`}>
            <span><T k={`gacha.companion.accessory.${item.id}`} variant="stacked" /></span><span className="text-xs"><T k={wearLabel(owned.has(item.id), shown)} variant="stacked" /></span>
          </button>;
        })}
      </div>
      <button type="button" className="btn btn-ghost mt-3 min-h-11" disabled={Object.keys(outfit).length === 0} onClick={onClear}><T k="gacha.companion.removeAll" variant="stacked" /></button>
    </> : null}
    {panel === "shop" ? <>
      <p className="mb-2 text-sm text-muted-foreground"><T k="gacha.companion.shop.note" /></p>
      {shop.balance === null ? null : <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        <Coins className="size-4 text-warning" aria-hidden="true" />
        <T k="gacha.companion.shop.balance" params={{ n: shop.balance }} />
      </p>}
      {status ? <p className="mb-2 text-sm text-muted-foreground"><T k={status} /></p> : null}
      {shop.status === "error" ? <button type="button" className="btn btn-outline btn-sm mb-2 min-h-11" onClick={shop.retry}><T k="gacha.retry" variant="stacked" /></button> : null}
      <p aria-live="polite" className="mb-2 min-h-5 text-sm font-medium">{message ? <T k={message} /> : null}</p>
      {filters}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const shown = outfit[item.slot] === item.id;
          const has = owned.has(item.id);
          const affordable = shop.balance !== null && shop.balance >= item.price;
          return <div key={item.id} className="flex flex-col gap-1 rounded-[10px] border border-border-hairline p-2 shadow-sm">
            <button type="button" aria-pressed={shown} onClick={() => onWear(item.id)}
              className={`btn h-auto min-h-14 flex-col gap-0.5 py-2 ${shown ? "btn-primary" : "btn-ghost"}`}>
              <span><T k={`gacha.companion.accessory.${item.id}`} variant="stacked" /></span>
              <span className="text-xs"><T k={wearLabel(has, shown)} variant="stacked" /></span>
            </button>
            {has ? <p className="py-2 text-center text-xs font-medium text-success"><T k="gacha.companion.shop.owned" /></p> : <>
              <p className="text-center text-xs tabular-nums text-muted-foreground"><T k="gacha.companion.shop.price" params={{ n: item.price }} /></p>
              <button type="button" className="btn btn-primary btn-sm min-h-11" disabled={!canBuy || !affordable} onClick={() => onBuy(item.id)}>
                <T k={shop.buying === item.id ? "gacha.companion.shop.buying" : status === null && !affordable ? "gacha.companion.shop.notEnough" : "gacha.companion.shop.buy"} variant="stacked" />
              </button>
            </>}
          </div>;
        })}
      </div>
    </> : null}
  </dialog>;
}
