import { useEffect, useState } from "react";
import { useAdventure } from "../../hooks/useAdventure";
import { useVocabulary } from "../../hooks/useVocabulary";
import { useSpeechState } from "../../hooks/useSpeechState";
import { AdventureHome } from "./AdventureHome";
import { StageMap } from "./StageMap";
import { QuizGame } from "./QuizGame";
import { SpiritCollection } from "./SpiritCollection";
import { RewardModal } from "./RewardModal";
import { CompanionGuide } from "./CompanionGuide";
import { Shop } from "./Shop";
import { DailyBonusModal } from "./DailyBonusModal";
import { BossBattle } from "./BossBattle";

export function SpiritAdventure() {
  const [showCompanion, setShowCompanion] = useState(true);

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
    bossState,
    pendingReward,
    coins,
    pendingDailyBonus,
    startQuiz,
    submitAnswer,
    tickTimer,
    claimReward,
    claimDailyBonus,
    drawGacha,
    goHome,
  } = useAdventure();

  const { words, loadVocabulary } = useVocabulary();
  const { speechSupported } = useSpeechState();

  // 載入詞彙用於遊戲
  useEffect(() => {
    loadVocabulary({ limit: 100 });
  }, [loadVocabulary]);

  // 處理關卡選擇
  const handleSelectStage = async (stageIndex: number) => {
    await startQuiz(stageIndex, words, speechSupported);
  };

  // 載入中
  if (isLoading && !progress) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-muted-foreground">載入遊戲中...</p>
        </div>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6">
        <div className="glass rounded-2xl shadow-floating p-6 text-center max-w-md">
          <span className="text-4xl mb-4">😢</span>
          <h2 className="text-lg font-semibold text-error mb-2">載入失敗</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-error btn-sm active:scale-[0.98]"
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
          <p className="text-muted-foreground">請先登入以開始遊戲</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 可愛小幫手 - 只在首頁和地圖顯示 */}
      {showCompanion && (gameView === "home" || gameView === "map") && (
        <CompanionGuide
          name="小星星"
          onDismiss={() => setShowCompanion(false)}
        />
      )}

      {/* 獎勵彈窗 */}
      {pendingReward && (
        <RewardModal reward={pendingReward} onClaim={claimReward} />
      )}

      {/* 每日獎勵彈窗 */}
      {pendingDailyBonus && (
        <DailyBonusModal bonus={pendingDailyBonus} onClaim={claimDailyBonus} />
      )}

      {/* 主要內容根據 gameView 切換 */}
      {gameView === "home" && (
        <AdventureHome
          progress={progress}
          onStartAdventure={() => setGameView("map")}
          onOpenCollection={() => setGameView("collection")}
          onOpenShop={() => setGameView("shop")}
        />
      )}

      {gameView === "shop" && (
        <Shop
          coins={coins}
          onDraw={drawGacha}
          onBack={() => setGameView("home")}
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

      {gameView === "boss" && quizState && bossState && currentStage && (
        <BossBattle
          stage={currentStage}
          quizState={quizState}
          bossState={bossState}
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
