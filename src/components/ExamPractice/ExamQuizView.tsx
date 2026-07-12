import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowRight, Check, Flag, X } from "lucide-react";
import type { ExamPaper, ExamQuizSession } from "../../types/exam";
import { playSound } from "../../services/gameService";
import { ExamRichText } from "./ExamRichText";
import { ExamQuestionImage } from "./ExamQuestionImage";
import { isLastQuestion, optionCountOf } from "./examSession";
import { CIRCLED_NUMBERS, questionLabel } from "./examUi";

interface ExamQuizViewProps {
  paper: ExamPaper;
  session: ExamQuizSession;
  onSubmitAnswer: (optionIndex: number) => void;
  onNext: () => void;
  onExit: () => void;
}

const INTERACTIVE_TARGETS =
  "button, a, input, textarea, select, [contenteditable='true'], [role='dialog']";

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    document.querySelector("dialog[open]")
  ) {
    return true;
  }
  return event.target instanceof Element && Boolean(event.target.closest(INTERACTIVE_TARGETS));
}

export function ExamQuizView({
  paper,
  session,
  onSubmitAnswer,
  onNext,
  onExit,
}: ExamQuizViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const questionCardRef = useRef<HTMLDivElement>(null);
  const question = session.questions[session.currentIndex];
  const optionCount = optionCountOf(question);
  const chosen = session.answers[session.currentIndex];
  const atLastQuestion = isLastQuestion(session);
  const progressPercentage =
    ((session.currentIndex + 1) / session.questions.length) * 100;

  // 答對放小煙火+音效;答錯播提示音(advance 會把 lastAnswerCorrect 重設為 null,每題都會觸發)
  useEffect(() => {
    if (session.lastAnswerCorrect === true) {
      playSound("correct");
      if (!shouldReduceMotion) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#10b981", "#34d399", "#6ee7b7"],
        });
      }
    } else if (session.lastAnswerCorrect === false) {
      playSound("wrong");
    }
  }, [session.lastAnswerCorrect, shouldReduceMotion]);

  // 鍵盤:1-4 作答,Enter 下一題
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (shouldIgnoreShortcut(event)) return;
      if (event.key === "Enter") {
        if (session.isAnswered) {
          event.preventDefault();
          onNext();
        }
        return;
      }
      if (session.isAnswered) return;
      const index = Number.parseInt(event.key, 10) - 1;
      if (Number.isInteger(index) && index >= 0 && index < optionCount) {
        event.preventDefault();
        onSubmitAnswer(index);
      }
    },
    [session.isAnswered, optionCount, onSubmitAnswer, onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    questionCardRef.current?.focus({ preventScroll: true });
  }, [session.currentIndex]);

  return (
    <div className="flex flex-col gap-4">
      {/* 頂部列 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onExit}
          className="btn btn-ghost btn-sm gap-1 rounded-full text-muted-foreground"
        >
          <X size={16} strokeWidth={2} />
          離開
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{session.scopeLabel}</span>
          {session.mode === "retry" && (
            <span className="badge badge-warning badge-sm">錯題重練</span>
          )}
          <span>
            {session.currentIndex + 1} / {session.questions.length}
          </span>
        </div>
      </div>

      {/* 進度條 */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-base-300"
        role="progressbar"
        aria-label={`練習進度：第 ${session.currentIndex + 1} 題，共 ${session.questions.length} 題`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercentage)}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
          initial={false}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
        />
      </div>

      {/* 題目卡 */}
      <motion.div
        ref={questionCardRef}
        tabIndex={-1}
        key={session.currentIndex}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
        className="flex flex-col gap-4 rounded-2xl border border-border-hairline bg-card p-5 shadow-elevated sm:p-6"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Flag size={14} strokeWidth={1.75} />
          原卷 {questionLabel(paper, question)}
        </div>

        <p className="text-lg leading-relaxed sm:text-xl">
          <ExamRichText text={question.text} />
        </p>

        {question.image && (
          <ExamQuestionImage
            image={question.image}
            number={question.number}
            questionPdf={paper.questionPdf}
            alt={question.imageAlt}
          />
        )}

        {/* 選項 */}
        <div
          className={
            question.imageContainsOptions
              ? "grid grid-cols-2 gap-3 sm:grid-cols-4"
              : "grid grid-cols-1 gap-3"
          }
        >
          {Array.from({ length: optionCount }).map((_, index) => {
            const optionText = question.options?.[index];
            const isCorrect = index === question.answerIndex;
            const isChosen = chosen === index;
            const optionLabel =
              optionText ??
              question.imageOptionLabels?.[index] ??
              `圖片中的選項 ${CIRCLED_NUMBERS[index]}`;
            const answerState = session.isAnswered
              ? isCorrect
                ? "，正確答案"
                : isChosen
                  ? "，你的答案，答錯"
                  : ""
              : "";

            let buttonClass =
              "btn btn-outline h-auto min-h-[44px] w-full justify-start rounded-xl px-4 py-3 text-left font-normal active:scale-[0.98]";
            if (session.isAnswered) {
              if (isCorrect) {
                buttonClass =
                  "btn btn-success h-auto min-h-[44px] w-full justify-start rounded-xl px-4 py-3 text-left font-normal";
              } else if (isChosen) {
                buttonClass =
                  "btn btn-error h-auto min-h-[44px] w-full justify-start rounded-xl px-4 py-3 text-left font-normal";
              } else {
                buttonClass =
                  "btn btn-ghost h-auto min-h-[44px] w-full justify-start rounded-xl px-4 py-3 text-left font-normal opacity-50";
              }
            }
            if (question.imageContainsOptions) {
              buttonClass = buttonClass.replace("justify-start", "justify-center");
            }

            return (
              <motion.button
                key={index}
                whileTap={
                  !session.isAnswered && !shouldReduceMotion ? { scale: 0.97 } : {}
                }
                onClick={() => onSubmitAnswer(index)}
                disabled={session.isAnswered}
                aria-label={`${CIRCLED_NUMBERS[index]} ${optionLabel}${answerState}`}
                className={buttonClass}
              >
                {question.imageContainsOptions ? (
                  <span className="text-xl font-semibold">
                    {CIRCLED_NUMBERS[index]}
                  </span>
                ) : (
                  <>
                    <span className="mr-3 shrink-0 text-base font-semibold">
                      {CIRCLED_NUMBERS[index]}
                    </span>
                    <span className="flex-1 whitespace-normal leading-relaxed">
                      {optionText ? <ExamRichText text={optionText} /> : null}
                    </span>
                  </>
                )}
                {session.isAnswered && isCorrect && (
                  <Check size={18} strokeWidth={2.5} className="shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* 即時回饋 + 解析 */}
        <AnimatePresence>
          {session.isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-xl p-4 ${
                session.lastAnswerCorrect ? "bg-success/15" : "bg-error/15"
              }`}
              role="status"
              aria-live="polite"
            >
              <p
                className={`font-semibold ${
                  session.lastAnswerCorrect ? "text-success" : "text-error"
                }`}
              >
                {session.lastAnswerCorrect
                  ? "🎉 答對了！"
                  : `😅 答錯了，正確答案是 ${CIRCLED_NUMBERS[question.answerIndex]}`}
              </p>
              {question.explanation && (
                <p className="mt-2 border-t border-border-hairline pt-2 text-sm leading-relaxed text-foreground/80">
                  <span className="font-semibold">解析：</span>
                  <ExamRichText text={question.explanation} />
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 下一題 */}
        {session.isAnswered && (
          <button
            onClick={onNext}
            className="btn btn-primary min-h-[48px] w-full gap-1.5 rounded-xl"
          >
            {atLastQuestion ? "完成練習" : "下一題"}
            <ArrowRight size={18} strokeWidth={2} />
          </button>
        )}
      </motion.div>

      <p className="text-center text-xs text-muted-foreground">
        可使用數字鍵 1-{optionCount} 作答，Enter 前往下一題
      </p>
    </div>
  );
}
