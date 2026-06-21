import { useCallback, useEffect, useMemo, useState } from "react";
import backgroundUrl from "../../../assets/games/kaplay-runner/background-sky-library.png";
import cardWrongUrl from "../../../assets/games/kaplay-runner/card-wrong.png";
import finishFlagUrl from "../../../assets/games/kaplay-runner/finish-flag.png";
import mascotIdleUrl from "../../../assets/games/kaplay-runner/mascot-idle.png";
import mascotJumpUrl from "../../../assets/games/kaplay-runner/mascot-jump.png";
import mascotRunUrl from "../../../assets/games/kaplay-runner/mascot-run.png";
import parallaxCloudsUrl from "../../../assets/games/kaplay-runner/parallax-clouds.png";
import platformBookUrl from "../../../assets/games/kaplay-runner/platform-book.png";
import tokenCorrectUrl from "../../../assets/games/kaplay-runner/token-correct.png";
import { useAuth } from "../../../hooks/useAuth";
import { useVocabulary } from "../../../hooks/useVocabulary";
import type { GameWordSeed } from "../../../services/gameWords";
import {
  getWordRunnerBestScore,
  shouldStartWordRunnerGame,
  WORD_RUNNER_BEST_SCORE_KEY,
} from "./wordRunnerData";
import { KaplayGameHost } from "./KaplayGameHost";
import type { WordRunnerAssets } from "./wordRunnerGame";

type WordRunnerPageProps = {
  onExit?: () => void;
  standalone?: boolean;
};

const WORD_RUNNER_ASSETS: WordRunnerAssets = {
  background: backgroundUrl,
  parallaxClouds: parallaxCloudsUrl,
  mascotIdle: mascotIdleUrl,
  mascotRun: mascotRunUrl,
  mascotJump: mascotJumpUrl,
  platformBook: platformBookUrl,
  tokenCorrect: tokenCorrectUrl,
  cardWrong: cardWrongUrl,
  finishFlag: finishFlagUrl,
};

function toGameWords(words: ReturnType<typeof useVocabulary>["words"]): GameWordSeed[] {
  return words
    .map((word) => ({
      word: word.word,
      def:
        word.definitions[0]?.definitionChinese ||
        word.definitions[0]?.definition ||
        "",
      emoji: word.emoji || "✨",
    }))
    .filter((word) => word.word.trim() && word.def.trim());
}

export default function WordRunnerPage({
  onExit,
  standalone = false,
}: WordRunnerPageProps) {
  const { user } = useAuth();
  const { words, loading, error, loadVocabulary } = useVocabulary();
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => getWordRunnerBestScore());
  const [vocabularyReady, setVocabularyReady] = useState(() => !user);

  useEffect(() => {
    if (!user) {
      setVocabularyReady(true);
      return;
    }

    let cancelled = false;
    setVocabularyReady(false);

    void (async () => {
      try {
        await loadVocabulary({ limit: 100 });
      } finally {
        if (!cancelled) {
          setVocabularyReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadVocabulary, user]);

  const runnerWords = useMemo(() => toGameWords(words), [words]);
  const canStartRunner = shouldStartWordRunnerGame({
    hasUser: Boolean(user),
    vocabularyReady,
  });

  const handleBestScoreChange = useCallback((nextBest: number) => {
    setBestScore(nextBest);
  }, []);

  const sourceStatus = user
    ? loading
      ? "正在載入你的字庫..."
      : `優先使用你的 ${runnerWords.length} 個字庫單字`
    : `未登入可遊玩，最高分保存在 ${WORD_RUNNER_BEST_SCORE_KEY}`;

  const gameHost = canStartRunner ? (
    <KaplayGameHost
      words={runnerWords}
      assets={WORD_RUNNER_ASSETS}
      onScoreChange={setScore}
      onBestScoreChange={handleBestScoreChange}
      onExit={standalone ? undefined : onExit}
      variant={standalone ? "standalone" : "embedded"}
    />
  ) : (
    <div
      className={
        standalone
          ? "flex h-full min-h-[320px] items-center justify-center rounded-[10px] border border-white/50 bg-white/60 shadow-sm"
          : "flex aspect-[16/10] items-center justify-center rounded-[12px] border border-border-hairline bg-card shadow-elevated"
      }
    >
      <span
        className="loading loading-spinner loading-lg text-primary"
        aria-label="正在載入遊戲"
      />
    </div>
  );

  if (standalone) {
    return (
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#e8f4ff] text-foreground">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white/80 px-3 shadow-sm backdrop-blur-xl sm:h-16 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="btn btn-sm rounded-[6px] border-border-hairline bg-background shadow-sm"
              >
                Back
              </button>
            )}
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                KAPLAY Pilot
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                Ollie Word Runner
              </h1>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-2 text-xs text-muted-foreground md:flex">
            ← / → 移動，Space 跳躍，P 暫停，Enter 重開
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="rounded-full border border-border-hairline bg-card px-3 py-1.5 shadow-sm">
              Score {score}
            </span>
            <span className="rounded-full border border-border-hairline bg-card px-3 py-1.5 shadow-sm">
              Best {bestScore}
            </span>
          </div>
        </header>

        {error && (
          <div className="shrink-0 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-muted-foreground">
            字庫載入失敗，會改用內建單字：{error}
          </div>
        )}

        <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-3">
          {gameHost}
        </main>

        <div className="z-20 flex h-8 shrink-0 items-center justify-between gap-2 border-t border-black/5 bg-white/75 px-3 text-[11px] text-muted-foreground backdrop-blur-xl sm:px-4">
          <span className="truncate">跳過錯誤卡片，收集符合提示的英文單字。</span>
          <span className="hidden truncate sm:block">{sourceStatus}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            KAPLAY Pilot
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Ollie Word Runner
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            跳過錯誤卡片，收集符合提示的英文單字。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-border-hairline bg-card px-3 py-1.5 shadow-sm">
            Score {score}
          </span>
          <span className="rounded-full border border-border-hairline bg-card px-3 py-1.5 shadow-sm">
            Best {bestScore}
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-3 rounded-[10px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
          字庫載入失敗，遊戲會使用內建單字繼續：{error}
        </div>
      )}

      {canStartRunner ? (
        <KaplayGameHost
          words={runnerWords}
          assets={WORD_RUNNER_ASSETS}
          onScoreChange={setScore}
          onBestScoreChange={handleBestScoreChange}
          onExit={onExit}
          variant="embedded"
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center rounded-[12px] border border-border-hairline bg-card shadow-elevated">
          <span
            className="loading loading-spinner loading-lg text-primary"
            aria-label="正在載入遊戲"
          />
        </div>
      )}

      <footer className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          鍵盤：← / → 微調位置，Space 或 ↑ 跳躍，P 暫停，Enter 重新開始。
        </span>
        <span>
          {sourceStatus}。
        </span>
      </footer>
    </div>
  );
}
