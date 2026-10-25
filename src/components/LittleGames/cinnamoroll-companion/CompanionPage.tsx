import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, Hand, Info, Rotate3d, RotateCcw } from "lucide-react";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { lazyWithReload } from "../../../utils/lazyWithReload";
import { createCompanionRuntime } from "./logic/companionRuntime";
import type { CompanionOutfit } from "../../../types/companion";
import { previewAccessory } from "./logic/outfit";
import { CompanionPanel } from "./CompanionPanel";

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
      大耳狗準備中…
    </div>
  );
}

function Notice({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-[16px] border border-white/70 bg-white/85 p-6 text-center shadow-lg backdrop-blur-md">
        <p className="text-4xl" aria-hidden="true">☁️</p>
        <h2 className="mt-3 text-lg font-semibold text-sky-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export default function CompanionPage({ onExit }: { onExit: () => void }) {
  const [webGL] = useState(hasWebGL);
  const [runtime] = useState(() => createCompanionRuntime(performance.now()));
  const [mode, setMode] = useState<"turn" | "pet">("turn");
  const [showCredit, setShowCredit] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"actions" | "outfit" | null>(null);
  const [outfit, setOutfit] = useState<CompanionOutfit>({});
  const openPanel = (next: "actions" | "outfit") => {
    runtime.setPetting(false);
    setMode("turn");
    setPanel(next);
  };
  const reducedMotion = Boolean(useReducedMotion());
  const hidden = usePageHidden();

  const chooseTurn = () => {
    runtime.setPetting(false);
    setMode("turn");
  };
  // Choosing petting gives a pat straight away, so the mode visibly starts;
  // pressing again pats again, which also serves keyboard users.
  const choosePet = () => {
    runtime.setPetting(true);
    setMode("pet");
    runtime.dispatch({ type: "pat", now: performance.now() });
  };
  const modeButton = (active: boolean) =>
    `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98] ${
      active ? "bg-sky-500 text-white shadow-sm" : "text-sky-950 hover:bg-white"
    }`;

  const backButton = (
    <button
      type="button"
      onClick={onExit}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      返回
    </button>
  );

  return (
    <div className="relative h-dvh w-full select-none overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      {webGL && !contextLost ? (
        <div className={panel ? "absolute inset-x-0 top-0 bottom-[45dvh]" : "absolute inset-0"}>
          <ErrorBoundary
            fallback={
              <Notice title="大耳狗暫時出不來" action={backButton}>
                3D 畫面載入失敗，請稍後再試一次。
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
        <Notice title="這台裝置無法顯示 3D 畫面" action={backButton}>
          瀏覽器沒有開啟 WebGL，換一個瀏覽器或裝置就能和大耳狗玩了。
        </Notice>
      ) : null}

      {contextLost ? (
        <Notice
          title="3D 畫面中斷了"
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
              重新載入
            </button>
          }
        >
          顯示卡暫時休息了一下，重新載入就好。
        </Notice>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">{backButton}</div>
        <div className="pointer-events-auto relative flex items-center gap-2">
          <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-sky-900 backdrop-blur-md">
            大耳狗 3D 夥伴
          </span>
          <button
            type="button"
            aria-expanded={showCredit}
            onClick={() => setShowCredit((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/70 bg-white/80 text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Info className="size-4" aria-hidden="true" />
            <span className="sr-only">模型出處</span>
          </button>
          {/* Required attribution for the CC BY 4.0 model, one tap away. */}
          {showCredit ? (
            <p className="absolute right-0 top-full mt-2 w-64 rounded-[12px] border border-white/70 bg-white/90 p-3 text-xs leading-5 text-sky-900 shadow-lg backdrop-blur-md">
              3D 模型：
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
              ，
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
            {mode === "turn" ? "拖曳轉一圈，點耳朵、肚子或手一起玩" : "在頭或耳朵上來回滑，摸摸我"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => openPanel("actions")}>動作</button>
            <button type="button" className="btn min-h-11 pointer-events-auto rounded-full" onClick={() => openPanel("outfit")}>換裝</button>
            <div
              role="group"
              aria-label="互動方式"
              className="pointer-events-auto inline-flex gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-md"
            >
              <button
                type="button"
                aria-pressed={mode === "turn"}
                onClick={chooseTurn}
                className={modeButton(mode === "turn")}
              >
                <Rotate3d className="size-4" aria-hidden="true" />
                轉一轉
              </button>
              <button
                type="button"
                aria-pressed={mode === "pet"}
                onClick={choosePet}
                className={modeButton(mode === "pet")}
              >
                <Hand className="size-4" aria-hidden="true" />
                摸摸頭
              </button>
            </div>
            <button
              type="button"
              onClick={() => runtime.resetView()}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-sky-950 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              回正
            </button>
          </div>
        </footer>
      ) : null}
      {panel && webGL && !contextLost ? <CompanionPanel panel={panel} outfit={outfit}
        onClose={() => setPanel(null)}
        onAction={(action) => { runtime.perform(action, performance.now()); setPanel(null); }}
        onPreview={(id) => setOutfit((current) => previewAccessory(current, id))}
        onClear={() => setOutfit({})} /> : null}
    </div>
  );
}
