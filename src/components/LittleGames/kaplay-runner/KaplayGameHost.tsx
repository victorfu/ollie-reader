import { useEffect, useRef } from "react";
import type { GameWordSeed } from "../../../services/gameWords";
import {
  createWordRunnerGame,
  type WordRunnerAssets,
  type WordRunnerCallbacks,
  type WordRunnerGameController,
} from "./wordRunnerGame";

type KaplayGameHostProps = {
  words: readonly GameWordSeed[];
  assets: WordRunnerAssets;
  onScoreChange?: (score: number) => void;
  onBestScoreChange?: (score: number) => void;
  onExit?: () => void;
};

export function KaplayGameHost({
  words,
  assets,
  onScoreChange,
  onBestScoreChange,
  onExit,
}: KaplayGameHostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<WordRunnerGameController | null>(null);
  const callbacksRef = useRef<WordRunnerCallbacks>({});

  useEffect(() => {
    callbacksRef.current = {
      onScoreChange,
      onBestScoreChange,
    };
  }, [onBestScoreChange, onScoreChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    controllerRef.current?.quit();
    controllerRef.current = createWordRunnerGame({
      canvas,
      words,
      assets,
      callbacks: {
        onScoreChange: (score) => callbacksRef.current.onScoreChange?.(score),
        onBestScoreChange: (score) =>
          callbacksRef.current.onBestScoreChange?.(score),
      },
    });

    return () => {
      controllerRef.current?.quit();
      controllerRef.current = null;
    };
  }, [assets, words]);

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-border-hairline bg-card shadow-elevated">
      <canvas
        ref={canvasRef}
        className="block aspect-[16/10] w-full bg-sky-100 outline-none"
        aria-label="Ollie Word Runner game canvas"
      />

      {onExit && (
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
