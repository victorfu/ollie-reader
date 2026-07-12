import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowRight, Check, Flag, X } from "lucide-react";
import type { ExamPaper, ExamQuizSession } from "../../types/exam";
import { FULL_SCOPE_ID, isTextQuestion } from "../../types/exam";
import { playSound } from "../../services/gameService";
import { useSpeechState } from "../../hooks/useSpeechState";
import { SpeakerButton } from "../TravelEnglish/SpeakerButton";
import { ExamRichText } from "./ExamRichText";
import { ExamQuestionImage } from "./ExamQuestionImage";
import { ExamTypedAnswerPanel } from "./ExamTypedAnswerPanel";
import { isEndOfSection, isLastQuestion, optionCountOf } from "./examSession";
import { CIRCLED_NUMBERS, questionLabel } from "./examUi";

interface ExamQuizViewProps {
  autoAdvanceOnCorrect: boolean;
  isAutoAdvancePaused: boolean;
  paper: ExamPaper;
  session: ExamQuizSession;
  onAutoAdvanceOnCorrectChange: (enabled: boolean) => void;
  /** 選擇題傳選項索引;打字題傳輸入字串。 */
  onSubmitAnswer: (answer: number | string) => void;
  onNext: () => void;
  onExit: () => void;
}

const INTERACTIVE_TARGETS =
  "button, a, input, textarea, select, [contenteditable='true'], [role='dialog']";
const AUTO_ADVANCE_DELAY_MS = 900;

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
  autoAdvanceOnCorrect,
  isAutoAdvancePaused,
  paper,
  session,
  onAutoAdvanceOnCorrectChange,
  onSubmitAnswer,
  onNext,
  onExit,
}: ExamQuizViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const { speak, speechSupported } = useSpeechState();
  const questionCardRef = useRef<HTMLDivElement>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const question = session.questions[session.currentIndex];
  const textQuestion = isTextQuestion(question) ? question : null;
  const choiceQuestion = isTextQuestion(question) ? null : question;
  const optionCount = optionCountOf(question);
  const chosen = session.answers[session.currentIndex];
  /** dictation 的語音由作答面板控制,其餘題型在題幹旁提供喇叭。 */
  const stemAudioText =
    question.audioText && textQuestion?.form !== "dictation"
      ? question.audioText
      : null;
  const atLastQuestion = isLastQuestion(session);
  const showsSectionResultNext =
    session.scopeId === FULL_SCOPE_ID && isEndOfSection(session);
  const progressPercentage =
    ((session.currentIndex + 1) / session.questions.length) * 100;

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current === null) return;
    window.clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = null;
  }, []);

  const handleNext = useCallback(() => {
    cancelAutoAdvance();
    onNext();
  }, [cancelAutoAdvance, onNext]);

  const handleExit = useCallback(() => {
    cancelAutoAdvance();
    onExit();
  }, [cancelAutoAdvance, onExit]);

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
          handleNext();
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
    [session.isAnswered, optionCount, onSubmitAnswer, handleNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    // 打字題由作答面板聚焦輸入框,避免互相搶焦點
    if (textQuestion) return;
    questionCardRef.current?.focus({ preventScroll: true });
  }, [session.currentIndex, textQuestion]);

  // 保留短暫正確回饋；手動前進、取消勾選或元件卸載都會清掉 timer。
  useEffect(() => {
    cancelAutoAdvance();
    if (
      !autoAdvanceOnCorrect ||
      isAutoAdvancePaused ||
      !session.isAnswered ||
      session.lastAnswerCorrect !== true
    ) {
      return;
    }
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      onNext();
    }, AUTO_ADVANCE_DELAY_MS);
    return cancelAutoAdvance;
  }, [
    autoAdvanceOnCorrect,
    cancelAutoAdvance,
    isAutoAdvancePaused,
    onNext,
    session.currentIndex,
    session.isAnswered,
    session.lastAnswerCorrect,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* 頂部列 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleExit}
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

        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-lg leading-relaxed sm:text-xl">
            <ExamRichText text={question.text} />
          </p>
          {stemAudioText && speechSupported && (
            <SpeakerButton
              text={stemAudioText}
              speak={speak}
              label="播放題目語音"
              className="shrink-0"
            />
          )}
        </div>

        {question.image && (
          <ExamQuestionImage
            image={question.image}
            number={question.number}
            questionPdf={paper.questionPdf}
            alt={question.imageAlt}
          />
        )}

        {/* 打字作答(英文句子練習) */}
        {textQuestion && (
          <ExamTypedAnswerPanel
            key={textQuestion.id}
            question={textQuestion}
            isAnswered={session.isAnswered}
            speechSupported={speechSupported}
            onSubmit={onSubmitAnswer}
            onNext={handleNext}
            speak={speak}
          />
        )}

        {/* 選項 */}
        {choiceQuestion && (
        <div
          className={
            choiceQuestion.imageContainsOptions
              ? "grid grid-cols-2 gap-3 sm:grid-cols-4"
              : "grid grid-cols-1 gap-3"
          }
        >
          {Array.from({ length: optionCount }).map((_, index) => {
            const optionText = choiceQuestion.options?.[index];
            const isCorrect = index === choiceQuestion.answerIndex;
            const isChosen = chosen === index;
            const optionLabel =
              optionText ??
              choiceQuestion.imageOptionLabels?.[index] ??
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
            if (choiceQuestion.imageContainsOptions) {
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
                {choiceQuestion.imageContainsOptions ? (
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
        )}

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
                  : textQuestion
                    ? "😅 答錯了"
                    : `😅 答錯了，正確答案是 ${CIRCLED_NUMBERS[choiceQuestion?.answerIndex ?? 0]}`}
              </p>
              {textQuestion && (
                <div className="mt-2 flex flex-col gap-1 border-t border-border-hairline pt-2 text-sm leading-relaxed">
                  {!session.lastAnswerCorrect && typeof chosen === "string" && (
                    <p className="text-error">你的答案：{chosen}</p>
                  )}
                  <p className="text-foreground/80">
                    <span className="font-semibold">標準答案：</span>
                    {textQuestion.acceptedAnswers[0]}
                  </p>
                </div>
              )}
              {question.explanation && (
                <p className="mt-2 border-t border-border-hairline pt-2 text-sm leading-relaxed text-foreground/80">
                  <span className="font-semibold">解析：</span>
                  <ExamRichText text={question.explanation} />
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 自動前進 + 下一題 */}
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[44px] cursor-pointer items-center justify-end gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10">
            <input
              type="checkbox"
              checked={autoAdvanceOnCorrect}
              onChange={(event) => {
                if (!event.target.checked) cancelAutoAdvance();
                onAutoAdvanceOnCorrectChange(event.target.checked);
              }}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span>答對時自動下一題</span>
          </label>

          {session.isAnswered && (
            <button
              onClick={handleNext}
              className="btn btn-primary min-h-[48px] w-full gap-1.5 rounded-xl"
            >
              {showsSectionResultNext
                ? "查看區段統計"
                : atLastQuestion
                  ? "完成練習"
                  : "下一題"}
              <ArrowRight size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground">
        {textQuestion
          ? "輸入答案後按 Enter 或「送出」作答，作答後按 Enter 前往下一題"
          : `可使用數字鍵 1-${optionCount} 作答，Enter 前往下一題`}
      </p>
    </div>
  );
}
