import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { QuizState, Stage } from "../../types/game";
import type { BossState } from "../../hooks/useAdventure";
import { SceneBackground } from "./SceneBackground";
import { QuizCard } from "./QuizCard";
import { BossHpBar } from "./BossHpBar";
import { useSpeechState } from "../../hooks/useSpeechState";

interface BossBattleProps {
  stage: Stage;
  quizState: QuizState;
  bossState: BossState;
  onSubmitAnswer: (answer: number | string) => void;
  onTickTimer: () => void;
  onQuit: () => void;
}

// 每個魔王的外觀
const BOSS_EMOJI: Record<string, string> = {
  "boss-1": "🛡️",
  "boss-2": "❄️",
  "boss-3": "🔥",
  "boss-4": "⚡",
  "boss-5": "🌪️",
  "boss-6": "🍥",
  "boss-7": "🎩",
  "boss-8": "👑",
};

export function BossBattle({
  stage,
  quizState,
  bossState,
  onSubmitAnswer,
  onTickTimer,
  onQuit,
}: BossBattleProps) {
  const currentQuestion = quizState.questions[quizState.currentIndex];
  const { speak } = useSpeechState();
  const reduce = useReducedMotion();

  // 計時器
  useEffect(() => {
    if (quizState.isAnswered) return;
    const timer = setInterval(() => onTickTimer(), 1000);
    return () => clearInterval(timer);
  }, [quizState.isAnswered, onTickTimer]);

  const defeated = bossState.bossHp <= 0;
  const bossEmoji = defeated ? "💥" : BOSS_EMOJI[stage.id] ?? "👾";

  // 受擊動畫：答題後依 lastHit 決定魔王被打(晃動變亮) 或玩家被打(輕晃)
  const bossAnim =
    quizState.isAnswered && !reduce
      ? bossState.lastHit === "boss"
        ? { x: [0, -8, 8, -5, 5, 0], filter: ["brightness(1)", "brightness(1.6)", "brightness(1)"] }
        : { rotate: [0, -4, 4, -2, 0] }
      : { y: [0, -6, 0] };

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
            {quizState.combo > 1 && (
              <motion.div
                key={quizState.combo}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="badge badge-warning badge-md sm:badge-lg font-bold shadow-lg"
              >
                🔥 {quizState.combo} 連擊{quizState.combo >= 3 ? " 爆擊!" : ""}
              </motion.div>
            )}
          </div>
        </div>

        {/* 魔王區 */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-error">
            ⚔️ 魔王戰：{stage.name}
          </h2>
          <motion.div
            animate={bossAnim}
            transition={{
              duration: quizState.isAnswered ? 0.5 : 2,
              repeat: quizState.isAnswered ? 0 : Infinity,
            }}
            className="text-7xl sm:text-8xl"
          >
            {bossEmoji}
          </motion.div>
          <BossHpBar hp={bossState.bossHp} maxHp={bossState.bossMaxHp} />
        </div>

        {/* 題目卡（每題重新掛載） */}
        <div className="flex-1 flex flex-col items-center justify-center">
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
              isAnswered={quizState.isAnswered}
              lastAnswerCorrect={quizState.lastAnswerCorrect}
              onAnswer={onSubmitAnswer}
              speak={speak}
            />
          </motion.div>
        </div>

        <div className="text-center mt-4">
          <p className="text-xs text-muted-foreground glass inline-block px-4 py-2 rounded-full">
            💥 答對就攻擊魔王，連續答對還能爆擊！
          </p>
        </div>
      </div>
    </SceneBackground>
  );
}

export default BossBattle;
