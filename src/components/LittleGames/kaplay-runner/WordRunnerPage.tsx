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
  WORD_RUNNER_BEST_SCORE_KEY,
} from "./wordRunnerData";
import { KaplayGameHost } from "./KaplayGameHost";
import type { WordRunnerAssets } from "./wordRunnerGame";

type WordRunnerPageProps = {
  onExit?: () => void;
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

export default function WordRunnerPage({ onExit }: WordRunnerPageProps) {
  const { user } = useAuth();
  const { words, loading, error, loadVocabulary } = useVocabulary();
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => getWordRunnerBestScore());

  useEffect(() => {
    if (!user) return;

    void loadVocabulary({ limit: 100 });
  }, [loadVocabulary, user]);

  const runnerWords = useMemo(() => toGameWords(words), [words]);

  const handleBestScoreChange = useCallback((nextBest: number) => {
    setBestScore(nextBest);
  }, []);

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

      <KaplayGameHost
        words={runnerWords}
        assets={WORD_RUNNER_ASSETS}
        onScoreChange={setScore}
        onBestScoreChange={handleBestScoreChange}
        onExit={onExit}
      />

      <footer className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          鍵盤：← / → 微調位置，Space 或 ↑ 跳躍，P 暫停，Enter 重新開始。
        </span>
        <span>
          {user
            ? loading
              ? "正在載入你的字庫..."
              : `本局會優先使用你的 ${runnerWords.length} 個字庫單字。`
            : `未登入也可遊玩；最高分保存在 ${WORD_RUNNER_BEST_SCORE_KEY}。`}
        </span>
      </footer>
    </div>
  );
}
