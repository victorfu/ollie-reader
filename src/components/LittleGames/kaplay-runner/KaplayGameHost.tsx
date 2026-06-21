import { useEffect, useRef, type PointerEvent } from "react";
import type { GameWordSeed } from "../../../services/gameWords";
import {
  createWordRunnerGame,
  type WordRunnerAssets,
  type WordRunnerCallbacks,
  type WordRunnerGameController,
} from "./wordRunnerGame";
import { scheduleKaplayInit } from "./kaplayLifecycle";

type KaplayGameHostProps = {
  words: readonly GameWordSeed[];
  assets: WordRunnerAssets;
  onScoreChange?: (score: number) => void;
  onBestScoreChange?: (score: number) => void;
  onExit?: () => void;
  variant?: "embedded" | "standalone";
};

export function KaplayGameHost({
  words,
  assets,
  onScoreChange,
  onBestScoreChange,
  onExit,
  variant = "embedded",
}: KaplayGameHostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<WordRunnerGameController | null>(null);
  const callbacksRef = useRef<WordRunnerCallbacks>({});
  const initialWordsRef = useRef(words);
  const isStandalone = variant === "standalone";

  useEffect(() => {
    callbacksRef.current = {
      onScoreChange,
      onBestScoreChange,
    };
  }, [onBestScoreChange, onScoreChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cancelInit = scheduleKaplayInit(() => {
      controllerRef.current = createWordRunnerGame({
        canvas,
        words: initialWordsRef.current,
        assets,
        callbacks: {
          onScoreChange: (score) =>
            callbacksRef.current.onScoreChange?.(score),
          onBestScoreChange: (score) =>
            callbacksRef.current.onBestScoreChange?.(score),
        },
      });
    });

    return () => {
      cancelInit();
      controllerRef.current?.quit();
      controllerRef.current = null;
    };
  }, [assets]);

  const holdButton = (
    event: PointerEvent<HTMLButtonElement>,
    onPress: () => void,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPress();
  };

  const releaseLeft = () => {
    controllerRef.current?.setLeftPressed(false);
  };

  const releaseRight = () => {
    controllerRef.current?.setRightPressed(false);
  };

  const canvasElement = (
      <canvas
        ref={canvasRef}
        className={
          isStandalone
            ? "block h-full w-full bg-sky-100 outline-none"
            : "block aspect-[16/10] w-full bg-sky-100 outline-none"
        }
        aria-label="Ollie Word Runner game canvas"
      />
  );

  if (isStandalone) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-3">
        <div
          className="relative aspect-[16/10] w-full overflow-hidden rounded-[10px] border border-white/60 bg-sky-100 shadow-lg"
          style={{ maxWidth: "min(100%, calc((100dvh - 7rem) * 1.6))" }}
        >
          {canvasElement}
        </div>

        <div className="flex w-full max-w-xs shrink-0 items-center justify-between gap-3 md:hidden">
          <div className="flex gap-3">
            <button
              type="button"
              aria-label="Move left"
              onPointerDown={(event) =>
                holdButton(event, () =>
                  controllerRef.current?.setLeftPressed(true),
                )
              }
              onPointerUp={releaseLeft}
              onPointerCancel={releaseLeft}
              onPointerLeave={releaseLeft}
              className="grid h-14 w-14 touch-none place-items-center rounded-full border border-white/70 bg-white/60 text-xl font-semibold text-slate-700 shadow-sm backdrop-blur-md active:scale-[0.98]"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Move right"
              onPointerDown={(event) =>
                holdButton(event, () =>
                  controllerRef.current?.setRightPressed(true),
                )
              }
              onPointerUp={releaseRight}
              onPointerCancel={releaseRight}
              onPointerLeave={releaseRight}
              className="grid h-14 w-14 touch-none place-items-center rounded-full border border-white/70 bg-white/60 text-xl font-semibold text-slate-700 shadow-sm backdrop-blur-md active:scale-[0.98]"
            >
              →
            </button>
          </div>
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(event) => {
              event.preventDefault();
              controllerRef.current?.jump();
            }}
            className="grid h-16 w-16 touch-none place-items-center rounded-full border border-white/70 bg-white/60 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md active:scale-[0.98]"
          >
            Jump
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-border-hairline bg-card shadow-elevated">
      {canvasElement}

      {!isStandalone && onExit && (
        <button
          type="button"
          onClick={onExit}
          className="btn btn-sm absolute left-3 top-3 z-20 rounded-[6px] border-border-hairline bg-background/80 shadow-sm backdrop-blur-md"
        >
          Back to games
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center sm:hidden">
        <span className="rounded-full border border-border-hairline bg-background/75 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
          Touch the canvas controls to move and jump
        </span>
      </div>
    </div>
  );
}
