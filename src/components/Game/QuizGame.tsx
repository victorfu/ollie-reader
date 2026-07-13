import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { QuizState, Stage } from "../../types/game";
import { SPIRIT_COMPONENTS } from "../../assets/spirits";
import { playSound } from "../../services/gameService";
import { SceneBackground } from "./SceneBackground";

interface QuizGameProps {
  stage: Stage;
  quizState: QuizState;
  onSubmitAnswer: (answer: number | string) => void;
  onTickTimer: () => void;
  onQuit: () => void;
}

export function QuizGame({
  stage,
  quizState,
  onSubmitAnswer,
  onTickTimer,
  onQuit,
}: QuizGameProps) {
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const progressPercentage =
    ((quizState.currentIndex + 1) / quizState.questions.length) * 100;

  // 取得關卡精靈
  const spiritId = stage.rewardSpiritId;
  const SpiritComponent = spiritId ? SPIRIT_COMPONENTS[spiritId] : null;

  // 計時器
  useEffect(() => {
    if (quizState.isAnswered) return;

    const timer = setInterval(() => {
      onTickTimer();
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState.isAnswered, onTickTimer]);

  // 答對時放煙火和播放音效
  useEffect(() => {
    if (quizState.lastAnswerCorrect === true) {
      playSound("correct");
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10b981", "#34d399", "#6ee7b7"],
      });
    } else if (quizState.lastAnswerCorrect === false) {
      playSound("wrong");
    }
  }, [quizState.lastAnswerCorrect]);

  // 鍵盤快捷鍵
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (quizState.isAnswered) return;

      const keyMap: Record<string, number> = {
        "1": 0,
        "2": 1,
        "3": 2,
        "4": 3,
      };

      if (keyMap[e.key] !== undefined) {
        onSubmitAnswer(keyMap[e.key]);
      }
    },
    [quizState.isAnswered, onSubmitAnswer],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 計算時間條顏色
  const getTimerColor = () => {
    if (quizState.timeLeft <= 3) return "bg-error";
    if (quizState.timeLeft <= 5) return "bg-warning";
    return "bg-primary";
  };

  return (
    <SceneBackground stageId={stage.id}>
      <div className="min-h-[calc(100vh-8rem)] flex flex-col p-4 sm:p-6">
        {/* 頂部狀態列 */}
        <div className="flex items-center justify-between mb-4 mt-10">
          <button
            onClick={onQuit}
            className="btn btn-ghost btn-sm glass rounded-full active:scale-[0.98]"
          >
            ✕ 離開
          </button>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* 生命值 */}
            <div className="flex items-center gap-1 glass px-3 py-1 rounded-full">
              {Array.from({ length: quizState.maxLives }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={false}
                  animate={{
                    scale: i < quizState.lives ? 1 : 0.8,
                    opacity: i < quizState.lives ? 1 : 0.3,
                  }}
                  className="text-lg sm:text-xl"
                >
                  {i < quizState.lives ? "❤️" : "🖤"}
                </motion.span>
              ))}
            </div>

            {/* 連擊數 */}
            {quizState.combo > 0 && (
              <motion.div
                key={quizState.combo}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="badge badge-warning badge-md sm:badge-lg font-bold shadow-lg"
              >
                🔥 {quizState.combo} 連擊
              </motion.div>
            )}

            {/* 分數 */}
            <div className="badge badge-primary badge-md sm:badge-lg shadow-lg">
              {quizState.score} 分
            </div>
          </div>
        </div>

        {/* 進度條 */}
        <div className="w-full glass rounded-full h-3 mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary to-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
          />
        </div>

      {/* 主遊戲區 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* 精靈展示 - 增強動畫 */}
        {SpiritComponent && (
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotate:
                quizState.lastAnswerCorrect === false ? [-5, 5, -5, 5, 0] : 0,
            }}
            transition={{
              y: { duration: 2, repeat: Infinity },
              rotate: { duration: 0.5 },
            }}
            className="mb-4 relative"
          >
            {/* 精靈光環 */}
            <motion.div
              className="absolute inset-0 bg-white/30 rounded-full blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <SpiritComponent size={100} animate />
          </motion.div>
        )}

        {/* 題目卡片 - 增強可愛風格 */}
        <motion.div
          key={quizState.currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card glass rounded-2xl shadow-floating w-full max-w-lg"
        >
          <div className="card-body">
            {/* 計時器 */}
            <div className="w-full mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">
                  第 {quizState.currentIndex + 1} / {quizState.questions.length}{" "}
                  題
                </span>
                <span
                  className={`text-lg font-bold ${
                    quizState.timeLeft <= 3 ? "text-error animate-pulse" : ""
                  }`}
                >
                  ⏱️ {quizState.timeLeft}s
                </span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full ${getTimerColor()} rounded-full`}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(quizState.timeLeft / 30) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* 單字 */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-primary mb-2">
                {currentQuestion.word}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                這個單字是什麼意思？
              </p>
            </div>

            {/* 選項 */}
            {currentQuestion.kind !== "spell" && (
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((option, index) => {
                const isCorrect = index === currentQuestion.correctIndex;
                const isSelected = quizState.isAnswered;

                let buttonClass =
                  "btn btn-outline w-full justify-start text-left h-auto rounded-xl py-4 px-4 active:scale-[0.98]";

                if (isSelected) {
                  if (isCorrect) {
                    buttonClass =
                      "btn btn-success w-full justify-start text-left h-auto rounded-xl py-4 px-4";
                  } else if (quizState.lastAnswerCorrect === false) {
                    buttonClass =
                      "btn btn-error w-full justify-start text-left h-auto rounded-xl py-4 px-4 opacity-50";
                  } else {
                    buttonClass =
                      "btn btn-ghost w-full justify-start text-left h-auto rounded-xl py-4 px-4 opacity-50";
                  }
                }

                return (
                  <motion.button
                    key={index}
                    whileHover={!isSelected ? { scale: 1.02 } : {}}
                    whileTap={!isSelected ? { scale: 0.98 } : {}}
                    onClick={() => !isSelected && onSubmitAnswer(index)}
                    disabled={isSelected}
                    className={buttonClass}
                  >
                    <span className="badge badge-ghost mr-3">{index + 1}</span>
                    <span className="flex-1">{option}</span>
                    {isSelected && isCorrect && (
                      <span className="text-xl">✓</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            )}

            {/* 答題結果 */}
            <AnimatePresence>
              {quizState.isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-4 p-3 rounded-xl text-center ${
                    quizState.lastAnswerCorrect
                      ? "bg-success/20 text-success"
                      : "bg-error/20 text-error"
                  }`}
                >
                  {quizState.lastAnswerCorrect ? (
                    <span className="font-bold">🎉 答對了！太棒了！</span>
                  ) : (
                    <span className="font-bold">😅 答錯了，再接再厲！</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* 鍵盤提示 */}
      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground glass inline-block px-4 py-2 rounded-full">
          💡 可使用數字鍵 1-4 快速作答
        </p>
      </div>
    </div>
    </SceneBackground>
  );
}

export default QuizGame;
