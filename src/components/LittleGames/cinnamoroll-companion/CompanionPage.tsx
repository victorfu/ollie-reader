import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, Info, RotateCcw } from "lucide-react";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { lazyWithReload } from "../../../utils/lazyWithReload";
import { createCompanionRuntime } from "./logic/companionRuntime";
import type { CompanionAccessory, CompanionOutfit } from "../../../types/companion";
import { accessorySlot, sameOutfit, shownOutfit, wearAccessory } from "./logic/outfit";
import { CompanionPanel, type CompanionPanelKind } from "./CompanionPanel";
import { useCompanionWardrobe, type PurchaseOutcome } from "./useCompanionWardrobe";
import { useLanguage } from "../../../hooks/useLanguage";
import type { MessageKey } from "../../../i18n/translate";
import { T } from "../../common/T";

// three.js only downloads once the device is known to support WebGL.
const CompanionScene = lazyWithReload(() => import("./CompanionScene"));

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

const PURCHASE_MESSAGES: Record<Exclude<PurchaseOutcome, "busy">, MessageKey> = {
  bought: "gacha.companion.shop.bought",
  insufficient: "gacha.companion.shop.insufficient",
  owned: "gacha.companion.shop.alreadyOwned",
  offline: "gacha.companion.shop.offline",
  failed: "gacha.companion.shop.failed",
};

function Loading() {
  return (
    <div
      role="status"
      className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-sky-900"
    >
      <span className="loading loading-spinner loading-sm" />
      <T k="gacha.companion.loading" />
    </div>
  );
}

function Notice({
  title,
  children,
  action,
}: {
  title: MessageKey;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-[16px] border border-white/70 bg-white/85 p-6 text-center shadow-lg backdrop-blur-md">
        <p className="text-4xl" aria-hidden="true">☁️</p>
        <h2 className="mt-3 text-lg font-semibold text-sky-950"><T k={title} /></h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export default function CompanionPage({ onExit }: { onExit: () => void }) {
  const [webGL] = useState(hasWebGL);
  const [runtime] = useState(() => createCompanionRuntime(performance.now()));
  const [showCredit, setShowCredit] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<CompanionPanelKind | null>(null);
  // Free try-ons of accessories the player does not own; never saved.
  const [trial, setTrial] = useState<CompanionOutfit>({});
  const [purchaseMessage, setPurchaseMessage] = useState<MessageKey | null>(null);
  const shop = useCompanionWardrobe();
  const view = { equipped: shop.wardrobe.equipped, trial };
  const outfit = shownOutfit(view);
  const reducedMotion = Boolean(useReducedMotion());
  const hidden = usePageHidden();
  const { t } = useLanguage();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as Window & { render_game_to_text?: () => string };
    const describe = () => JSON.stringify({
      ready, panel, outfit, trial,
      wardrobe: { status: shop.status, owned: [...shop.wardrobe.owned], balance: shop.balance },
      coordinates: "canvas client pixels, x right, y down; spin in radians",
      pet: runtime.pet.phase, patUntil: runtime.pet.patUntil,
      action: runtime.performance?.action ?? null,
      spin: { yaw: runtime.spin.yaw, pitch: runtime.spin.pitch },
    });
    target.render_game_to_text = describe;
    return () => {
      if (target.render_game_to_text === describe) delete target.render_game_to_text;
    };
  }, [outfit, panel, ready, runtime, shop.balance, shop.status, shop.wardrobe.owned, trial]);

  const openPanel = (kind: CompanionPanelKind) => {
    setPurchaseMessage(null);
    setPanel(kind);
  };

  const wear = (id: CompanionAccessory) => {
    const next = wearAccessory(view, id, shop.wardrobe.owned);
    setTrial(next.trial);
    if (!sameOutfit(next.equipped, view.equipped)) shop.equip(next.equipped);
  };

  const takeAllOff = () => {
    setTrial({});
    if (Object.keys(view.equipped).length > 0) shop.equip({});
  };

  const buy = async (id: CompanionAccessory) => {
    setPurchaseMessage(null);
    const outcome = await shop.purchase(id);
    if (outcome === "busy") return;
    setPurchaseMessage(PURCHASE_MESSAGES[outcome]);
    if (outcome !== "bought") return;
    // The purchase already put it on; drop any try-on covering that slot.
    setTrial((current) => {
      const next = { ...current };
      delete next[accessorySlot(id)];
      return next;
    });
    runtime.perform("jump", performance.now());
  };

  const backButton = (
    <button
      type="button"
      onClick={onExit}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <T k="gacha.companion.back" />
    </button>
  );

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      {webGL && !contextLost ? (
        <div className={panel ? "absolute inset-x-0 top-0 bottom-[45dvh]" : "absolute inset-0"}>
          <ErrorBoundary
            fallback={
              <Notice title="gacha.companion.loadFailedTitle" action={backButton}>
                <T k="gacha.companion.loadFailedBody" />
              </Notice>
            }
          >
            <Suspense fallback={null}>
              <CompanionScene
                key={sceneKey}
                runtime={runtime}
                outfit={outfit}
                reducedMotion={reducedMotion}
                paused={hidden}
                onReady={() => setReady(true)}
                onContextLost={() => setContextLost(true)}
              />
            </Suspense>
          </ErrorBoundary>
          {ready ? null : <Loading />}
        </div>
      ) : null}

      {!webGL ? (
        <Notice title="gacha.companion.noWebglTitle" action={backButton}>
          <T k="gacha.companion.noWebglBody" />
        </Notice>
      ) : null}

      {contextLost ? (
        <Notice
          title="gacha.companion.contextLostTitle"
          action={
            <button
              type="button"
              onClick={() => {
                setContextLost(false);
                setReady(false);
                setSceneKey((key) => key + 1);
              }}
              className="btn btn-primary min-h-11 rounded-full px-5"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <T k="gacha.companion.reload" />
            </button>
          }
        >
          <T k="gacha.companion.contextLostBody" />
        </Notice>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">{backButton}</div>
        <div className="pointer-events-auto relative flex items-center gap-2">
          <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-sky-900 backdrop-blur-md">
            <T k="gacha.companion.badge" />
          </span>
          <button
            type="button"
            aria-expanded={showCredit}
            onClick={() => setShowCredit((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/80 text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Info className="size-4" aria-hidden="true" />
            <span className="sr-only">{t("gacha.companion.credit")}</span>
          </button>
          {/* Required attribution for the CC BY 4.0 model, one tap away. */}
          {showCredit ? (
            <p className="absolute right-0 top-full mt-2 w-64 rounded-[12px] border border-white/70 bg-white/90 p-3 text-xs leading-5 text-sky-900 shadow-lg backdrop-blur-md">
              {t("gacha.companion.creditPrefix")}
              <a
                href="https://sketchfab.com/3d-models/cinnamoroll-eae98497b99f47b8897c4ffd06521e31"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-sky-950"
              >
                “Cinnamoroll”
              </a>{" "}
              by{" "}
              <a
                href="https://sketchfab.com/kraevaya201"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-sky-950"
              >
                fukkacumy
              </a>
              {t("gacha.companion.creditSeparator")}
              <a
                href="http://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-sky-950"
              >
                CC BY 4.0
              </a>
            </p>
          ) : null}
        </div>
      </header>

      {webGL && !contextLost ? (
        <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p
            aria-live="polite"
            className="rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm backdrop-blur-md"
          >
            <T k="gacha.companion.hint" />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => openPanel("actions")}><T k="gacha.companion.actions" /></button>
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => openPanel("outfit")}><T k="gacha.companion.outfit" /></button>
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => openPanel("shop")}><T k="gacha.companion.shop" /></button>
            <button
              type="button"
              onClick={() => runtime.resetView()}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <T k="gacha.companion.resetView" />
            </button>
          </div>
        </footer>
      ) : null}
      {panel && webGL && !contextLost ? <CompanionPanel panel={panel} view={view} shop={shop} message={purchaseMessage}
        onClose={() => setPanel(null)}
        onAction={(action) => { runtime.perform(action, performance.now()); setPanel(null); }}
        onPat={() => { runtime.dispatch({ type: "pat", now: performance.now() }); setPanel(null); }}
        onWear={wear}
        onClear={takeAllOff}
        onBuy={(id) => { void buy(id); }} /> : null}
    </div>
  );
}
