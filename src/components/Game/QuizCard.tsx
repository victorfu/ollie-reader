import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleX,
  Timer,
  Volume2,
} from "lucide-react";
import type { QuizQuestion } from "../../types/game";
import { playSound } from "../../services/gameService";
import { SpellChips } from "./SpellChips";
import { splitWordForms } from "../../utils/wordForms";
import { useLanguage } from "../../hooks/useLanguage";
import type { MessageKey } from "../../i18n/translate";
import { T } from "../common/T";

interface QuizCardProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  /** 每題總秒數。必填 — 若讓它有預設值，改遊戲規則時時間條的百分比會默默算錯 */
  timeLimit: number;
  isAnswered: boolean;
  lastAnswerCorrect: boolean | null;
  /** 本題推進後就會結算（沒命了 / 最後一題），按鈕改成「看結果」 */
  isLastStep?: boolean;
  isSettling?: boolean;
  onAnswer: (answer: number | string) => void;
  /** 答錯／逾時、或句子填空作答後手動推進。其他題型答對由父層自動推進，不顯示按鈕 */
  onNext?: () => void;
  speak?: (text: string) => void;
}

// 聽力題與看圖題的題幹看不到英文單字，揭曉答案時要補上
const HIDES_WORD: Record<string, boolean> = { listen: true, emoji: true };

// 各題型的小提示
const PROMPT_HINT: Record<string, MessageKey> = {
  meaning: "adventure.quiz.prompt.meaning",
  listen: "adventure.quiz.prompt.listen",
  reverse: "adventure.quiz.prompt.reverse",
  emoji: "adventure.quiz.prompt.emoji",
  spell: "adventure.quiz.prompt.spell",
  cloze: "adventure.quiz.prompt.cloze",
};

/**
 * 共用題目卡：時間條 + 依 kind 的題幹 + 作答區（選項 / 拼字）+ 結果回饋。
 * 不含生命/連擊/分數 HUD，讓 QuizGame 與 BossBattle 都能重用。
 * 父層請以 key={questionIndex} 掛載，確保每題狀態（拼字進度、自動唸）重置。
 */
export function QuizCard({
  question,
  questionIndex,
  totalQuestions,
  timeLeft,
  timeLimit,
  isAnswered,
  lastAnswerCorrect,
  isLastStep = false,
  isSettling = false,
  onAnswer,
  onNext,
  speak,
}: QuizCardProps) {
  const { t } = useLanguage();
  const promptHint = PROMPT_HINT[question.kind];
  // 句子填空答對也停住（父層不自動推進），和答錯一樣等玩家按「下一題」
  const waitsForNext =
    lastAnswerCorrect === false || question.kind === "cloze";

  // 聽力題進場自動唸（StrictMode 以 ref 防雙念）
  const spokenIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (
      question.kind === "listen" &&
      speak &&
      spokenIndexRef.current !== questionIndex
    ) {
      spokenIndexRef.current = questionIndex;
      speak(question.word);
    }
  }, [question, questionIndex, speak]);

  // 句子填空作答後自動唸完整句子一次
  const spokenSentenceIndexRef = useRef<number>(-1);
  useEffect(() => {
    if (
      isAnswered &&
      question.kind === "cloze" &&
      speak &&
      spokenSentenceIndexRef.current !== questionIndex
    ) {
      spokenSentenceIndexRef.current = questionIndex;
      speak(question.sentence);
    }
  }, [isAnswered, question, questionIndex, speak]);

  // 答對放煙火 + 音效
  useEffect(() => {
    if (lastAnswerCorrect === true) {
      playSound("correct");
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.6 },
        colors: ["#f9a8d4", "#c4b5fd", "#fbcfe8", "#fcd34d"],
      });
    } else if (lastAnswerCorrect === false) {
      playSound("wrong");
    }
  }, [lastAnswerCorrect]);

  // 鍵盤：作答用 1-4（僅選項題）；停住等推進時用 Enter
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isAnswered) {
        if (
          onNext &&
          !isSettling &&
          waitsForNext &&
          e.key === "Enter"
        ) {
          e.preventDefault();
          onNext();
        }
        return;
      }
      if (question.kind === "spell") return;
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (map[e.key] !== undefined) onAnswer(map[e.key]);
    },
    [
      isAnswered,
      isSettling,
      waitsForNext,
      question.kind,
      onAnswer,
      onNext,
    ],
  );
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const timerColor =
    timeLeft <= 3 ? "bg-error" : timeLeft <= 5 ? "bg-warning" : "bg-primary";

  return (
    <div className="card glass rounded-2xl shadow-floating w-full max-w-lg">
      <div className="card-body">
        {/* 時間條 */}
        <div className="w-full mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">
              <T
                k="adventure.quiz.questionCount"
                params={{ current: questionIndex + 1, total: totalQuestions }}
              />
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-lg font-bold tabular-nums ${
                timeLeft <= 3 ? "text-error animate-pulse" : ""
              }`}
            >
              <Timer className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {timeLeft}s
            </span>
          </div>
          <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full ${timerColor} rounded-full`}
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / timeLimit) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* 題幹（依題型） */}
        <div className="text-center mb-6">
          {question.kind === "meaning" && (
            <h2 className="text-3xl font-bold text-primary mb-2">
              {question.word}
            </h2>
          )}
          {question.kind === "reverse" && (
            <h2 className="text-3xl font-bold text-secondary mb-2">
              {question.prompt}
            </h2>
          )}
          {question.kind === "emoji" && (
            <div className="text-7xl mb-2">{question.prompt}</div>
          )}
          {question.kind === "listen" && (
            <button
              onClick={() => speak?.(question.word)}
              className="btn btn-primary gap-2 rounded-full text-lg min-h-14 px-8 active:scale-95"
            >
              <Volume2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              <T k="adventure.quiz.listenAgain" />
            </button>
          )}
          {question.kind === "cloze" && (
            <>
              <h2 className="text-xl font-semibold leading-relaxed text-secondary mb-2">
                {question.prompt}
              </h2>
              <p className="text-base text-muted-foreground">{question.hint}</p>
            </>
          )}
          {question.kind === "spell" && (
            <h2 className="text-2xl font-bold text-secondary mb-2">
              {question.hint}
            </h2>
          )}

          <p className="text-sm text-muted-foreground mt-2">
            {promptHint ? <T k={promptHint} /> : null}
          </p>
        </div>

        {/* 作答區 */}
        {question.kind === "spell" ? (
          <SpellChips
            letters={question.letters}
            disabled={isAnswered}
            onSubmit={(attempt) => onAnswer(attempt)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correctIndex;

              let buttonClass =
                "btn btn-outline w-full justify-start text-left h-auto rounded-xl py-4 px-4 active:scale-[0.98]";
              if (isAnswered) {
                if (isCorrect) {
                  buttonClass =
                    "btn btn-success w-full justify-start text-left h-auto rounded-xl py-4 px-4";
                } else if (lastAnswerCorrect === false) {
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
                  whileHover={!isAnswered ? { scale: 1.02 } : {}}
                  whileTap={!isAnswered ? { scale: 0.98 } : {}}
                  onClick={() => !isAnswered && onAnswer(index)}
                  disabled={isAnswered}
                  className={buttonClass}
                >
                  <span className="badge badge-ghost mr-3">{index + 1}</span>
                  <span className="flex-1">{option}</span>
                  {isAnswered && isCorrect && (
                    <Check
                      className="h-5 w-5 shrink-0"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* 結果回饋 */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 p-3 rounded-xl text-center ${
                lastAnswerCorrect
                  ? "bg-success/20 text-success"
                  : "bg-error/20 text-error"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2 font-bold">
                {lastAnswerCorrect ? (
                  <>
                    <CircleCheck
                      className="h-5 w-5 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <T k="adventure.quiz.correct" />
                  </>
                ) : (
                  <>
                    <CircleX
                      className="h-5 w-5 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span>
                      <T
                        k="adventure.quiz.wrong"
                        params={{
                          answer:
                            question.kind === "spell"
                              ? question.word
                              : question.options[question.correctIndex],
                        }}
                      />
                    </span>
                  </>
                )}
              </span>

              {/* 聽力／看圖題的題幹沒有英文單字，揭曉時補上並可再聽一次 */}
              {HIDES_WORD[question.kind] && (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-xs opacity-70">
                    <T k="adventure.quiz.word" />
                  </span>
                  <span className="text-lg font-bold tracking-tight">
                    {question.word}
                  </span>
                  {speak && (
                    <button
                      type="button"
                      onClick={() => speak(question.word)}
                      aria-label={t("adventure.quiz.listenAgainWord", {
                        word: question.word,
                      })}
                      className="btn btn-ghost btn-xs btn-circle"
                    >
                      <Volume2
                        className="h-4 w-4"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              )}

              {/* 句子填空揭曉完整句子（答案字加粗）與翻譯，可再聽一次整句 */}
              {question.kind === "cloze" && (
                <div className="mt-2 space-y-1 text-base-content">
                  <p className="text-base leading-relaxed">
                    {splitWordForms(question.sentence, question.word).map(
                      (part, i) =>
                        part.match ? (
                          <strong key={i}>{part.text}</strong>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                    )}
                    {speak && (
                      <button
                        type="button"
                        onClick={() => speak(question.sentence)}
                        aria-label={t("adventure.quiz.listenSentence")}
                        className="btn btn-ghost btn-xs btn-circle pointer-coarse:size-11 ml-1 align-middle"
                      >
                        <Volume2
                          className="h-4 w-4"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </p>
                  {question.translation && (
                    <p className="text-sm opacity-70">{question.translation}</p>
                  )}
                </div>
              )}

              {/* 答錯（以及句子填空）不自動跳題：讓玩家看清答案，自己決定何時繼續 */}
              {onNext && waitsForNext && (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={isSettling}
                  autoFocus
                  className="btn btn-primary btn-sm mt-3 min-h-11 gap-1 px-5 active:scale-[0.98]"
                >
                  <T
                    k={
                      isSettling
                        ? "adventure.settling"
                        : isLastStep
                          ? "adventure.quiz.seeResults"
                          : "adventure.quiz.next"
                    }
                  />
                  <ArrowRight
                    className="h-4 w-4"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default QuizCard;
