import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { Home, RotateCcw, Trophy } from "lucide-react";
import type { ExamPaper, ExamQuizResult } from "../../types/exam";
import { ExamRichText } from "./ExamRichText";
import { ExamQuestionImage } from "./ExamQuestionImage";
import { CIRCLED_NUMBERS, questionLabel } from "./examUi";

interface ExamResultViewProps {
  paper: ExamPaper;
  result: ExamQuizResult;
  scopeLabel: string;
  onRetryWrong: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function ExamResultView({
  paper,
  result,
  scopeLabel,
  onRetryWrong,
  onRestart,
  onExit,
}: ExamResultViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const percent =
    result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const isPerfect = result.score === result.total && result.total > 0;

  // 進成績頁放一次煙火,滿分加大
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (shouldReduceMotion) return;
    confetti({
      particleCount: isPerfect ? 180 : 80,
      spread: isPerfect ? 110 : 70,
      origin: { y: 0.5 },
    });
  }, [isPerfect, shouldReduceMotion]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* 成績卡 */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
        className="rounded-2xl border border-border-hairline bg-card p-6 text-center shadow-elevated"
      >
        <p className="text-sm text-muted-foreground">
          {scopeLabel}
          {result.mode === "retry" && "・錯題重練"}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-6xl font-semibold tracking-tight"
        >
          {percent}
          <span className="ml-1 text-2xl text-muted-foreground">%</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          正確率・答對 {result.score} / {result.total} 題
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {isPerfect && (
            <span className="badge badge-success gap-1">
              🎉 全部答對，太厲害了！
            </span>
          )}
          {result.isNewBest && (
            <span className="badge badge-success gap-1">
              <Trophy size={13} strokeWidth={2} />
              新紀錄！
            </span>
          )}
        </div>
      </motion.div>

      {/* 動作列 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {result.wrong.length > 0 && (
          <button
            onClick={onRetryWrong}
            className="btn btn-primary min-h-[48px] flex-1 gap-1.5 rounded-xl"
          >
            <RotateCcw size={18} strokeWidth={2} />
            錯題重練（{result.wrong.length} 題）
          </button>
        )}
        <button
          onClick={onRestart}
          className="btn btn-outline min-h-[48px] flex-1 rounded-xl"
        >
          再練一次
        </button>
        <button
          onClick={onExit}
          className="btn btn-ghost min-h-[48px] flex-1 gap-1.5 rounded-xl"
        >
          <Home size={18} strokeWidth={2} />
          回列表
        </button>
      </div>

      {/* 錯題檢討 */}
      {result.wrong.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">
            錯題檢討（{result.wrong.length} 題）
          </h3>
          {result.wrong.map((question, index) => {
            const chosen = result.wrongChosen[index];
            return (
              <article
                key={question.id}
                className="flex flex-col gap-2 rounded-xl border border-border-hairline bg-card p-4 shadow-soft"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  原卷 {questionLabel(paper, question)}
                </p>
                <p className="leading-relaxed">
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
                <div className="flex flex-col gap-1 text-sm">
                  <p className="text-error">
                    你的答案：{CIRCLED_NUMBERS[chosen]}
                    {(question.options?.[chosen] ??
                      question.imageOptionLabels?.[chosen]) && (
                      <>
                        {" "}
                        <ExamRichText
                          text={
                            question.options?.[chosen] ??
                            question.imageOptionLabels?.[chosen] ??
                            ""
                          }
                        />
                      </>
                    )}
                  </p>
                  <p className="text-success">
                    正確答案：{CIRCLED_NUMBERS[question.answerIndex]}
                    {(question.options?.[question.answerIndex] ??
                      question.imageOptionLabels?.[question.answerIndex]) && (
                      <>
                        {" "}
                        <ExamRichText
                          text={
                            question.options?.[question.answerIndex] ??
                            question.imageOptionLabels?.[question.answerIndex] ??
                            ""
                          }
                        />
                      </>
                    )}
                  </p>
                </div>
                {question.explanation && (
                  <p className="border-t border-border-hairline pt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold">解析：</span>
                    <ExamRichText text={question.explanation} />
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
