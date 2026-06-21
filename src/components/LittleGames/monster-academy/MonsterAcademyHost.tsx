import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Cookie, Play, Shield, Sparkles, Sword } from "lucide-react";
import {
  createMonsterAcademyGame,
  type MonsterAcademyAssets,
  type MonsterAcademyGameController,
  type MonsterAcademySnapshot,
} from "./monsterAcademyGame";
import { scheduleKaplayInit } from "./kaplayLifecycle";

type MonsterAcademyHostProps = {
  assets: MonsterAcademyAssets;
  onSnapshot?: (snapshot: MonsterAcademySnapshot) => void;
};

let activeMonsterAcademyGame: MonsterAcademyGameController | null = null;

const MOBILE_COMMANDS = [
  { action: "attack" as const, label: "Attack", icon: Sword },
  { action: "magic" as const, label: "Magic", icon: Sparkles },
  { action: "item" as const, label: "Cookie", icon: Cookie },
  { action: "run" as const, label: "Retreat", icon: Shield },
];

export function MonsterAcademyHost({
  assets,
  onSnapshot,
}: MonsterAcademyHostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MonsterAcademyGameController | null>(null);
  const callbacksRef = useRef({ onSnapshot });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MonsterAcademySnapshot | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    callbacksRef.current = { onSnapshot };
  }, [onSnapshot]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const width = Math.floor(Math.min(rect.width, rect.height * 1.6));
      const height = Math.floor(width / 1.6);
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
        activeMonsterAcademyGame?.quit();
        const controller = createMonsterAcademyGame({
          canvas,
          assets,
          callbacks: {
            onReady: () => {
              if (!disposed) setLoading(false);
            },
            onSnapshot: (nextSnapshot) => {
              if (disposed) return;
              setSnapshot(nextSnapshot);
              callbacksRef.current.onSnapshot?.(nextSnapshot);
            },
            onError: (nextError) => {
              if (!disposed) setError(nextError.message);
            },
          },
        });
        controllerRef.current = controller;
        activeMonsterAcademyGame = controller;
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Unable to start Monster Academy.";
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
        if (activeMonsterAcademyGame === controller) {
          activeMonsterAcademyGame = null;
        }
        controller.quit();
      }
    };
  }, [assets]);

  const canUseBattleCommands =
    snapshot?.mode === "battle" && !snapshot.paused && snapshot.enemyName !== null;
  const gameFrameStyle: CSSProperties =
    canvasSize.width > 0
      ? { width: canvasSize.width, height: canvasSize.height }
      : { aspectRatio: "16 / 10", width: "100%" };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 sm:gap-3">
      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-2 sm:items-center sm:pt-0"
      >
        <div
          className="relative overflow-hidden rounded-[14px] border border-white/15 bg-[#15172c] shadow-2xl"
          style={gameFrameStyle}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none bg-[#15172c]"
            aria-label="Ollie Monster Academy game canvas"
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#15172c]">
              <span
                className="loading loading-spinner loading-lg text-warning"
                aria-label="載入遊戲中"
              />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#15172c]/95 px-6 text-center">
              <div className="max-w-md rounded-[14px] border border-white/15 bg-white/10 p-5 text-white shadow-xl backdrop-blur-xl">
                <p className="text-base font-semibold">遊戲載入失敗</p>
                <p className="mt-2 text-sm text-white/75">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:hidden">
        {MOBILE_COMMANDS.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onClick={() => controllerRef.current?.useAction(action)}
            disabled={!canUseBattleCommands}
            className="inline-flex min-h-12 flex-col items-center justify-center rounded-[10px] border border-white/15 bg-white/10 px-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md transition active:scale-[0.98] disabled:opacity-45"
          >
            <Icon className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => controllerRef.current?.advance()}
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-[10px] border border-amber-200/50 bg-amber-300 px-1 text-[11px] font-semibold text-slate-950 shadow-sm transition active:scale-[0.98]"
        >
          <Play className="mb-0.5 size-4" strokeWidth={1.8} aria-hidden="true" />
          OK
        </button>
      </div>
    </div>
  );
}
