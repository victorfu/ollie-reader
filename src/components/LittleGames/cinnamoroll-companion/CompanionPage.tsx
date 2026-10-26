import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, Info, RotateCcw } from "lucide-react";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { lazyWithReload } from "../../../utils/lazyWithReload";
import { createCompanionRuntime } from "./logic/companionRuntime";
import type { CompanionOutfit } from "../../../types/companion";
import { previewAccessory } from "./logic/outfit";
import { CompanionPanel } from "./CompanionPanel";
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
        <h2 className="mt-3 text-lg font-semibold text-sky-950"><T k={title} variant="stacked" /></h2>
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
  const [panel, setPanel] = useState<"actions" | "outfit" | null>(null);
  const [outfit, setOutfit] = useState<CompanionOutfit>({});
  const reducedMotion = Boolean(useReducedMotion());
  const hidden = usePageHidden();
  const { t } = useLanguage();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as Window & { render_game_to_text?: () => string };
    const describe = () => JSON.stringify({
      ready, panel, outfit,
      coordinates: "canvas client pixels, x right, y down; spin in radians",
      pet: runtime.pet.phase, patUntil: runtime.pet.patUntil,
      action: runtime.performance?.action ?? null,
      spin: { yaw: runtime.spin.yaw, pitch: runtime.spin.pitch },
    });
    target.render_game_to_text = describe;
    return () => {
      if (target.render_game_to_text === describe) delete target.render_game_to_text;
    };
  }, [outfit, panel, ready, runtime]);

  const backButton = (
    <button
      type="button"
      onClick={onExit}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <T k="gacha.companion.back" variant="stacked" />
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
              <T k="gacha.companion.reload" variant="stacked" />
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
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => setPanel("actions")}><T k="gacha.companion.actions" variant="stacked" /></button>
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => setPanel("outfit")}><T k="gacha.companion.outfit" variant="stacked" /></button>
            <button
              type="button"
              onClick={() => runtime.resetView()}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <T k="gacha.companion.resetView" variant="stacked" />
            </button>
          </div>
        </footer>
      ) : null}
      {panel && webGL && !contextLost ? <CompanionPanel panel={panel} outfit={outfit}
        onClose={() => setPanel(null)}
        onAction={(action) => { runtime.perform(action, performance.now()); setPanel(null); }}
        onPat={() => { runtime.dispatch({ type: "pat", now: performance.now() }); setPanel(null); }}
        onPreview={(id) => setOutfit((current) => previewAccessory(current, id))}
        onClear={() => setOutfit({})} /> : null}
    </div>
  );
}
