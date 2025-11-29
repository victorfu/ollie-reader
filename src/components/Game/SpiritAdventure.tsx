import { useEffect } from "react";
import { useAdventure } from "../../hooks/useAdventure";
import { useVocabulary } from "../../hooks/useVocabulary";
import { AdventureHome } from "./AdventureHome";
import { StageMap } from "./StageMap";
import { QuizGame } from "./QuizGame";
import { SpiritCollection } from "./SpiritCollection";
import { RewardModal } from "./RewardModal";

export function SpiritAdventure() {
  const {
    progress,
    isLoading,
    error,
    gameView,
    setGameView,
    stages,
    currentStage,
    isStageCompleted,
    isStagePlayable,
    quizState,
    pendingReward,
    startQuiz,
    submitAnswer,
    tickTimer,
    claimReward,
    goHome,
  } = useAdventure();

  const { words, loadVocabulary } = useVocabulary();

  // 載入詞彙用於遊戲
  useEffect(() => {
    loadVocabulary({ limit: 100 });
  }, [loadVocabulary]);

  // 處理關卡選擇
  const handleSelectStage = async (stageIndex: number) => {
    await startQuiz(stageIndex, words);
  };

  // 載入中
  if (isLoading && !progress) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/70">載入遊戲中...</p>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="card bg-error/10 border border-error p-6 text-center max-w-md">
          <span className="text-4xl mb-4">😢</span>
          <h2 className="text-xl font-bold text-error mb-2">載入失敗</h2>
          <p className="text-base-content/70 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-error btn-sm"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  // 未登入或無進度
  if (!progress) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🎮</span>
          <p className="text-base-content/70">請先登入以開始遊戲</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 獎勵彈窗 */}
      {pendingReward && (
        <RewardModal reward={pendingReward} onClaim={claimReward} />
      )}

      {/* 主要內容根據 gameView 切換 */}
      {gameView === "home" && (
        <AdventureHome
          progress={progress}
          onStartAdventure={() => setGameView("map")}
          onOpenCollection={() => setGameView("collection")}
        />
      )}

      {gameView === "map" && (
        <StageMap
          stages={stages}
          progress={progress}
          isStageCompleted={isStageCompleted}
          isStagePlayable={isStagePlayable}
          onSelectStage={handleSelectStage}
          onBack={goHome}
        />
      )}

      {gameView === "quiz" && quizState && currentStage && (
        <QuizGame
          stage={currentStage}
          quizState={quizState}
          onSubmitAnswer={submitAnswer}
          onTickTimer={tickTimer}
          onQuit={() => setGameView("map")}
        />
      )}

      {gameView === "collection" && (
        <SpiritCollection progress={progress} onBack={goHome} />
      )}

      {gameView === "reward" && (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}
    </div>
  );
}

export default SpiritAdventure;
