import { Map, Pause, Play, Sparkles, Utensils, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { scheduleKaplayInit } from "../kaplayLifecycle";
import {
  createWonderAcademyGame,
  WONDER_ACADEMY_HEIGHT,
  WONDER_ACADEMY_WIDTH,
  type WonderAcademyAssets,
  type WonderAcademyGameController,
} from "./wonderAcademyGame";
import type { WonderAcademyAction, WonderAcademyState } from "./wonderAcademyLogic";

type WonderAcademyHostProps = {
  state: WonderAcademyState;
  onAction: (action: WonderAcademyAction) => void;
  assets: WonderAcademyAssets;
};

let activeWonderAcademyGame: WonderAcademyGameController | null = null;

const MOBILE_TRIAL_COMMANDS = [
  { action: { type: "comfort" } as const, label: "Comfort", icon: Sparkles },
  {
    action: { type: "skill", skillId: "tiny-flash" } as const,
    label: "Flash",
    icon: WandSparkles,
  },
  {
    action: { type: "snack", snackId: "starberry-cookie" } as const,
    label: "Snack",
    icon: Utensils,
  },
  { action: { type: "attune" } as const, label: "Attune", icon: Sparkles },
];

export default function WonderAcademyHost({
  state,
  onAction,
  assets,
}: WonderAcademyHostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<WonderAcademyGameController | null>(null);
  const callbacksRef = useRef({ onAction });
  const stateRef = useRef(state);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    callbacksRef.current = { onAction };
  }, [onAction]);

  useEffect(() => {
    stateRef.current = state;
    controllerRef.current?.updateState(state);
  }, [state]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    const aspectRatio = WONDER_ACADEMY_WIDTH / WONDER_ACADEMY_HEIGHT;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const width = Math.floor(Math.min(rect.width, rect.height * aspectRatio));
      const height = Math.floor(width / aspectRatio);
      setCanvasSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    const queueMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(queueMeasure);

    resizeObserver.observe(stage);
    queueMeasure();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const cancelScheduledInit = scheduleKaplayInit(() => {
      if (disposed) return;

      try {
        activeWonderAcademyGame?.quit();
        const controller = createWonderAcademyGame({
          canvas,
          assets,
          state: stateRef.current,
          onAction: (action) => callbacksRef.current.onAction(action),
          onReady: () => {
            if (!disposed) setLoading(false);
          },
          onError: (nextError) => {
            if (disposed) return;
            setError(nextError.message);
            setLoading(false);
          },
        });
        controllerRef.current = controller;
        activeWonderAcademyGame = controller;
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Unable to start Wonder Academy.";
        setError(message);
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      cancelScheduledInit();
      const controller = controllerRef.current;
      controllerRef.current = null;
      if (controller) {
        if (activeWonderAcademyGame === controller) {
          activeWonderAcademyGame = null;
        }
        controller.quit();
      }
    };
  }, [assets]);

  const hasProgress = Boolean(state.progress);
  const isPaused = state.paused || state.isPaused;
  const isMoodTrial = state.mode === "moodTrial";
  const canOpenMap = hasProgress && !isPaused;
  const canUseTrialCommands = isMoodTrial && !isPaused;
  const gameFrameStyle: CSSProperties =
    canvasSize.width > 0
      ? { width: canvasSize.width, height: canvasSize.height }
      : { aspectRatio: "16 / 10", width: "100%" };

  return (
    <div className="flex h-full min-h-[420px] w-full flex-col gap-2 sm:gap-3">
      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-1 sm:items-center sm:pt-0"
      >
        <div
          className="relative overflow-hidden rounded-[14px] border border-white/15 bg-[#122022] shadow-2xl"
          style={gameFrameStyle}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none bg-[#122022]"
            aria-label="Wonder Academy game canvas"
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#122022]">
              <span
                className="loading loading-spinner loading-lg text-primary"
                aria-label="Loading Wonder Academy"
              />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#122022]/95 px-6 text-center">
              <div className="max-w-md rounded-[14px] border border-white/15 bg-white/10 p-5 text-white shadow-xl backdrop-blur-xl">
                <p className="text-base font-semibold">Game failed to load</p>
                <p className="mt-2 text-sm text-white/75">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => controllerRef.current?.dispatch({ type: "openRegionMap" })}
          disabled={!canOpenMap}
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-[10px] border border-white/15 bg-white/10 px-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md transition active:scale-[0.98] disabled:opacity-45"
        >
          <Map className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
          Map
        </button>
        <button
          type="button"
          onClick={() => controllerRef.current?.dispatch({ type: "togglePause" })}
          disabled={!hasProgress}
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-[10px] border border-white/15 bg-white/10 px-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md transition active:scale-[0.98] disabled:opacity-45"
        >
          {isPaused ? (
            <Play className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Pause className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
          )}
          {isPaused ? "Resume" : "Pause"}
        </button>
        {MOBILE_TRIAL_COMMANDS.map(({ action, label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => controllerRef.current?.dispatch(action)}
            disabled={!canUseTrialCommands}
            className="inline-flex min-h-12 flex-col items-center justify-center rounded-[10px] border border-white/15 bg-white/10 px-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md transition active:scale-[0.98] disabled:opacity-45 data-[primary=true]:border-amber-200/50 data-[primary=true]:bg-amber-300 data-[primary=true]:text-slate-950"
            data-primary={action.type === "attune"}
          >
            <Icon className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
