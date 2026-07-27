import { useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Heart, Lightbulb, X } from "lucide-react";
import type { QuizState, Stage } from "../../types/game";
import { SceneBackground } from "./SceneBackground";
import { QuizCard } from "./QuizCard";
import { useSpeechState } from "../../hooks/useSpeechState";

interface QuizGameProps {
  stage: Stage;
  quizState: QuizState;
  timeLimit: number;
  onSubmitAnswer: (answer: number | string) => void;
  onAdvanceQuestion: () => void;
  onTickTimer: () => void;
  onQuit: () => void;
}

export function QuizGame({
  stage,
  quizState,
  timeLimit,
  onSubmitAnswer,
  onAdvanceQuestion,
  onTickTimer,
  onQuit,
}: QuizGameProps) {
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const progressPercentage =
    ((quizState.currentIndex + 1) / quizState.questions.length) * 100;

  const { speak } = useSpeechState();

  // 推進後就會結算：沒命了，或已是最後一題
  const isLastStep =
    quizState.lives <= 0 ||
    quizState.currentIndex >= quizState.questions.length - 1;

  // 計時器
  useEffect(() => {
    if (quizState.isAnswered) return;
    const timer = setInterval(() => {
      onTickTimer();
    }, 1000);
    return () => clearInterval(timer);
  }, [quizState.isAnswered, onTickTimer]);

  return (
    <SceneBackground stageId={stage.id}>
      <div className="min-h-[calc(100vh-8rem)] flex flex-col p-4 sm:p-6">
        {/* 頂部狀態列 */}
        <div className="flex items-center justify-between mb-4 mt-10">
          <button
            onClick={onQuit}
            className="btn btn-ghost btn-sm glass gap-1 rounded-full active:scale-[0.98]"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            離開
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
                >
                  <Heart
                    className={`h-5 w-5 ${
                      i < quizState.lives
                        ? "fill-error text-error"
                        : "text-base-content/25"
                    }`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </motion.span>
              ))}
            </div>

            {/* 連擊數 */}
            {quizState.combo > 0 && (
              <motion.div
                key={quizState.combo}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="badge badge-warning badge-md sm:badge-lg gap-1 font-bold text-white shadow-lg"
              >
                <Flame className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {quizState.combo} 連擊
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
          {/* 題目卡（每題重新掛載以重置拚字/自動唸狀態） */}
          <motion.div
            key={quizState.currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex justify-center"
          >
            <QuizCard
              question={currentQuestion}
              questionIndex={quizState.currentIndex}
              totalQuestions={quizState.questions.length}
              timeLeft={quizState.timeLeft}
              timeLimit={timeLimit}
              isAnswered={quizState.isAnswered}
              lastAnswerCorrect={quizState.lastAnswerCorrect}
              isLastStep={isLastStep}
              onAnswer={onSubmitAnswer}
              onNext={onAdvanceQuestion}
              speak={speak}
            />
          </motion.div>
        </div>

        {/* 鍵盤提示 */}
        <div className="text-center mt-4">
          <p className="text-xs text-muted-foreground glass inline-flex items-center gap-1.5 px-4 py-2 rounded-full">
            <Lightbulb
              className="h-3.5 w-3.5"
              strokeWidth={2}
              aria-hidden="true"
            />
            選項題可用數字鍵 1-4 作答，答錯後按 Enter 繼續
          </p>
        </div>
      </div>
    </SceneBackground>
  );
}

export default QuizGame;
